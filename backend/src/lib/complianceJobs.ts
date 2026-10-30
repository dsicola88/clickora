/**
 * Fila persistente de auditorias de conformidade (PostgreSQL).
 * Enqueue rápido na API; claim com FOR UPDATE SKIP LOCKED no worker.
 * At-least-once + idempotência no processador — não exact-once.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { extractPresellSignals } from "../compliance/extractPresellSignals";
import { runPresellComplianceAudit, type PresellLike } from "../compliance/service";

export type EnqueueComplianceJobResult =
  | { ok: true; jobId: string; scheduled: true; deduped: boolean }
  | { ok: false; scheduled: false; error: string; code: "NOT_FOUND" | "FORBIDDEN" | "DB_ERROR" };

const DEFAULT_MAX_ATTEMPTS = Math.max(1, Math.min(10, Number(process.env.COMPLIANCE_JOB_MAX_ATTEMPTS || "3") || 3));
const LEASE_SECONDS = Math.max(30, Math.min(600, Number(process.env.COMPLIANCE_JOB_LEASE_SECONDS || "90") || 90));
const JOB_TIMEOUT_MS = Math.max(5_000, Math.min(180_000, Number(process.env.COMPLIANCE_JOB_TIMEOUT_MS || "60000") || 60_000));
/** Backpressure: atrasa run_after se pending+processing excederem este soft max (nunca drop). */
const PENDING_SOFT_MAX = Math.max(
  100,
  Math.min(50_000, Number(process.env.COMPLIANCE_JOB_PENDING_SOFT_MAX || "5000") || 5000),
);
/**
 * Limite GLOBAL de jobs `processing` (todas as instâncias).
 * Claim serializado com advisory lock — N workers × concurrency local não ultrapassa este tecto.
 */
const GLOBAL_CONCURRENCY = Math.max(
  1,
  Math.min(32, Number(process.env.COMPLIANCE_AUDIT_GLOBAL_CONCURRENCY || "4") || 4),
);
/** Namespace estável para pg_advisory_xact_lock (não colidir com outros locks da app). */
const CLAIM_ADVISORY_LOCK_KEY = 872_314_001;

export type ComplianceJobRow = {
  id: string;
  user_id: string;
  presell_id: string;
  content_fingerprint: string;
  skip_destination_probe: boolean;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after: Date;
  lease_owner: string | null;
  lease_until: Date | null;
  last_error: string | null;
};

function truncateError(msg: string): string {
  return msg.replace(/\s+/g, " ").trim().slice(0, 500);
}

function assertLegacyDisabledInProduction(): void {
  if (process.env.NODE_ENV === "production" && process.env.COMPLIANCE_AUDIT_LEGACY_UNBOUNDED === "1") {
    console.error(
      "[complianceJobs] COMPLIANCE_AUDIT_LEGACY_UNBOUNDED=1 ignorado em produção — use a fila persistente.",
    );
  }
}

export function complianceJobConfig() {
  return {
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    lease_seconds: LEASE_SECONDS,
    timeout_ms: JOB_TIMEOUT_MS,
    pending_soft_max: PENDING_SOFT_MAX,
    global_concurrency: GLOBAL_CONCURRENCY,
  };
}

/**
 * Valida ownership e cria (ou reutiliza) job pending/processing.
 * Nunca descarta silenciosamente: falha de BD → scheduled:false explícito.
 */
export async function enqueueComplianceJob(args: {
  userId: string;
  presellId: string;
  /** Se omitido, calcula a partir da página. */
  contentFingerprint?: string;
  skipDestinationProbe?: boolean;
}): Promise<EnqueueComplianceJobResult> {
  assertLegacyDisabledInProduction();
  const skipProbe = args.skipDestinationProbe !== false;

  try {
    const page = await systemPrisma.presellPage.findFirst({
      where: { id: args.presellId },
      select: {
        id: true,
        userId: true,
        title: true,
        type: true,
        language: true,
        category: true,
        content: true,
        settings: true,
        videoUrl: true,
        status: true,
        contentFingerprint: true,
      },
    });
    if (!page) {
      return { ok: false, scheduled: false, error: "Presell não encontrada.", code: "NOT_FOUND" };
    }
    if (page.userId !== args.userId) {
      return { ok: false, scheduled: false, error: "Acesso negado.", code: "FORBIDDEN" };
    }

    const fingerprint =
      args.contentFingerprint ||
      extractPresellSignals({
        title: page.title,
        type: page.type,
        language: page.language,
        category: page.category,
        content: page.content,
        settings: page.settings,
        videoUrl: page.videoUrl,
      }).contentFingerprint;

    // Soft backpressure usa cache (evitar COUNT em cada create sob storm).
    const pendingCount = await getCachedBacklog();
    const overflow = pendingCount >= PENDING_SOFT_MAX;
    const runAfter = overflow
      ? new Date(Date.now() + Math.min(120_000, 5_000 + (pendingCount - PENDING_SOFT_MAX) * 50))
      : new Date();
    if (overflow) {
      console.warn("[complianceJobs] soft backpressure", {
        pending: pendingCount,
        soft_max: PENDING_SOFT_MAX,
        presell_id_prefix: page.id.slice(0, 8),
      });
    }

    try {
      // Happy path: 1 INSERT. Dedupe via índice parcial único (P2002 → reutilizar).
      const job = await systemPrisma.presellComplianceJob.create({
        data: {
          userId: page.userId,
          presellId: page.id,
          contentFingerprint: fingerprint,
          skipDestinationProbe: skipProbe,
          status: "pending",
          maxAttempts: DEFAULT_MAX_ATTEMPTS,
          runAfter,
        },
        select: { id: true },
      });
      backlogCache = { at: backlogCache.at, n: backlogCache.n + 1 };
      return { ok: true, jobId: job.id, scheduled: true, deduped: false };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const again = await systemPrisma.presellComplianceJob.findFirst({
          where: {
            presellId: page.id,
            contentFingerprint: fingerprint,
            skipDestinationProbe: skipProbe,
            status: { in: ["pending", "processing"] },
          },
          select: { id: true },
        });
        if (again) {
          return { ok: true, jobId: again.id, scheduled: true, deduped: true };
        }
      }
      throw e;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "db_error";
    console.error("[complianceJobs] enqueue failed", truncateError(msg));
    return { ok: false, scheduled: false, error: "Falha ao agendar auditoria.", code: "DB_ERROR" };
  }
}

/** Compat: create draft — userId + page já conhecidos. */
export async function enqueuePresellDraftAuditJob(page: {
  id: string;
  userId: string;
  title: string;
  type: string;
  language: string | null;
  category: string | null;
  content: unknown;
  settings: unknown;
  videoUrl?: string | null;
}): Promise<EnqueueComplianceJobResult> {
  const fingerprint = extractPresellSignals({
    title: page.title,
    type: page.type,
    language: page.language,
    category: page.category,
    content: page.content,
    settings: page.settings,
    videoUrl: page.videoUrl,
  }).contentFingerprint;
  return enqueueComplianceJob({
    userId: page.userId,
    presellId: page.id,
    contentFingerprint: fingerprint,
    skipDestinationProbe: true,
  });
}

export async function reclaimExpiredLeases(): Promise<number> {
  const res = await systemPrisma.$executeRaw`
    UPDATE "presell_compliance_jobs"
    SET
      "status" = 'pending'::"PresellComplianceJobStatus",
      "lease_owner" = NULL,
      "lease_until" = NULL,
      "updated_at" = NOW(),
      "last_error" = COALESCE("last_error", 'lease_expired')
    WHERE "status" = 'processing'::"PresellComplianceJobStatus"
      AND "lease_until" IS NOT NULL
      AND "lease_until" < NOW()
  `;
  return typeof res === "number" ? res : 0;
}

/** Páginas presas em checking sem job activo → unchecked + reenqueue. */
export async function recoverStuckCheckingPages(args?: { olderThanMinutes?: number }): Promise<number> {
  const minutes = Math.max(5, args?.olderThanMinutes ?? 15);
  const stuck = await systemPrisma.$queryRaw<Array<{ id: string; user_id: string }>>`
    SELECT p.id, p.user_id
    FROM "presell_pages" p
    WHERE p.compliance_gate = 'checking'
      AND p.updated_at < NOW() - (${minutes}::text || ' minutes')::interval
      AND NOT EXISTS (
        SELECT 1 FROM "presell_compliance_jobs" j
        WHERE j.presell_id = p.id
          AND j.status IN ('pending'::"PresellComplianceJobStatus", 'processing'::"PresellComplianceJobStatus")
      )
    LIMIT 100
  `;
  let n = 0;
  for (const row of stuck) {
    await systemPrisma.presellPage.update({
      where: { id: row.id },
      data: { complianceGate: "unchecked" },
    });
    await enqueueComplianceJob({
      userId: row.user_id,
      presellId: row.id,
      skipDestinationProbe: true,
    });
    n += 1;
  }
  return n;
}

/**
 * Claim atómico com tecto global de `processing`.
 * Advisory lock evita dois workers a ultrapassar GLOBAL_CONCURRENCY sob race.
 */
export async function claimNextComplianceJob(workerId: string): Promise<ComplianceJobRow | null> {
  const leaseSec = LEASE_SECONDS;
  const globalLimit = GLOBAL_CONCURRENCY;
  return systemPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAIM_ADVISORY_LOCK_KEY})`;
    const countRows = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n
      FROM "presell_compliance_jobs"
      WHERE "status" = 'processing'::"PresellComplianceJobStatus"
    `;
    const processing = countRows[0]?.n ?? 0;
    if (processing >= globalLimit) return null;

    const rows = await tx.$queryRaw<ComplianceJobRow[]>`
      UPDATE "presell_compliance_jobs" AS j
      SET
        "status" = 'processing'::"PresellComplianceJobStatus",
        "lease_owner" = ${workerId},
        "lease_until" = NOW() + (${leaseSec}::text || ' seconds')::interval,
        "attempts" = j."attempts" + 1,
        "started_at" = COALESCE(j."started_at", NOW()),
        "updated_at" = NOW()
      WHERE j.id = (
        SELECT id FROM "presell_compliance_jobs"
        WHERE "status" = 'pending'::"PresellComplianceJobStatus"
          AND "run_after" <= NOW()
        ORDER BY "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING
        j.id,
        j.user_id,
        j.presell_id,
        j.content_fingerprint,
        j.skip_destination_probe,
        j.status::text,
        j.attempts,
        j.max_attempts,
        j.run_after,
        j.lease_owner,
        j.lease_until,
        j.last_error
    `;
    return rows[0] ?? null;
  });
}

async function markCompleted(jobId: string): Promise<void> {
  await systemPrisma.presellComplianceJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      leaseOwner: null,
      leaseUntil: null,
      finishedAt: new Date(),
      lastError: null,
    },
  });
}

async function markFailedOrRetry(job: ComplianceJobRow, errMsg: string): Promise<"retry" | "failed"> {
  const attempts = job.attempts;
  const maxAttempts = job.max_attempts || DEFAULT_MAX_ATTEMPTS;
  if (attempts < maxAttempts) {
    const backoffSec = Math.min(300, Math.pow(2, Math.max(0, attempts - 1)) * 5);
    await systemPrisma.presellComplianceJob.update({
      where: { id: job.id },
      data: {
        status: "pending",
        leaseOwner: null,
        leaseUntil: null,
        runAfter: new Date(Date.now() + backoffSec * 1000),
        lastError: truncateError(errMsg),
      },
    });
    return "retry";
  }
  await systemPrisma.presellComplianceJob.update({
    where: { id: job.id },
    data: {
      status: "failed",
      leaseOwner: null,
      leaseUntil: null,
      finishedAt: new Date(),
      lastError: truncateError(errMsg),
    },
  });
  // Não deixar gate em checking eternamente
  const page = await systemPrisma.presellPage.findFirst({
    where: { id: job.presell_id, userId: job.user_id },
    select: { id: true, complianceGate: true },
  });
  if (page?.complianceGate === "checking") {
    await systemPrisma.presellPage.update({
      where: { id: page.id },
      data: { complianceGate: "unchecked" },
    });
  }
  return "failed";
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Processa um job já claimed. Idempotente: se já houver audit final com o mesmo fingerprint, completa sem reexecutar.
 */
export async function processClaimedComplianceJob(job: ComplianceJobRow): Promise<{
  outcome: "completed" | "retry" | "failed" | "cancelled";
}> {
  const page = await systemPrisma.presellPage.findFirst({
    where: { id: job.presell_id },
  });
  if (!page) {
    await systemPrisma.presellComplianceJob.update({
      where: { id: job.id },
      data: {
        status: "cancelled",
        finishedAt: new Date(),
        leaseOwner: null,
        leaseUntil: null,
        lastError: "presell_deleted",
      },
    });
    return { outcome: "cancelled" };
  }
  if (page.userId !== job.user_id) {
    await markFailedOrRetry(job, "tenant_mismatch");
    return { outcome: "failed" };
  }

  const signals = extractPresellSignals({
    title: page.title,
    type: page.type,
    language: page.language,
    category: page.category,
    content: page.content,
    settings: page.settings,
    videoUrl: page.videoUrl,
  });

  // Conteúdo mudou desde o enqueue → cancelar este job (um novo deve ser enfileirado pelo save)
  if (signals.contentFingerprint !== job.content_fingerprint) {
    await systemPrisma.presellComplianceJob.update({
      where: { id: job.id },
      data: {
        status: "cancelled",
        finishedAt: new Date(),
        leaseOwner: null,
        leaseUntil: null,
        lastError: "fingerprint_stale",
      },
    });
    return { outcome: "cancelled" };
  }

  // Idempotência: audit recente com mesmo fingerprint e gate final
  const latest = await systemPrisma.presellComplianceAudit.findFirst({
    where: { presellId: page.id, userId: page.userId },
    orderBy: { createdAt: "desc" },
    select: { contentFingerprint: true, gate: true },
  });
  if (
    latest &&
    latest.contentFingerprint === job.content_fingerprint &&
    latest.gate !== "checking" &&
    latest.gate !== "unchecked" &&
    page.complianceGate !== "checking" &&
    page.complianceGate !== "unchecked"
  ) {
    await markCompleted(job.id);
    return { outcome: "completed" };
  }

  const presell: PresellLike = {
    ...page,
    contentFingerprint: job.content_fingerprint,
  };

  try {
    await withTimeout(
      runPresellComplianceAudit({
        presell,
        skipDestinationProbe: job.skip_destination_probe,
      }),
      JOB_TIMEOUT_MS,
      "compliance_audit",
    );
    await markCompleted(job.id);
    return { outcome: "completed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "audit_error";
    const r = await markFailedOrRetry(job, msg);
    return { outcome: r };
  }
}

export async function getComplianceJobQueueSnapshot() {
  const since24h = new Date(Date.now() - 24 * 3600_000);
  const [pending, processing, failed24h, completed24h, cancelled24h, created24h, oldestPending, failedOpen] =
    await Promise.all([
      systemPrisma.presellComplianceJob.count({ where: { status: "pending" } }),
      systemPrisma.presellComplianceJob.count({ where: { status: "processing" } }),
      systemPrisma.presellComplianceJob.count({
        where: { status: "failed", finishedAt: { gte: since24h } },
      }),
      systemPrisma.presellComplianceJob.count({
        where: { status: "completed", finishedAt: { gte: since24h } },
      }),
      systemPrisma.presellComplianceJob.count({
        where: { status: "cancelled", finishedAt: { gte: since24h } },
      }),
      systemPrisma.presellComplianceJob.count({
        where: { createdAt: { gte: since24h } },
      }),
      systemPrisma.presellComplianceJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      systemPrisma.presellComplianceJob.count({ where: { status: "failed" } }),
    ]);
  const terminal24h = completed24h + failed24h + cancelled24h;
  return {
    ...complianceJobConfig(),
    pending,
    processing,
    backlog: pending + processing,
    failed_24h: failed24h,
    completed_24h: completed24h,
    cancelled_24h: cancelled24h,
    created_24h: created24h,
    /** Reconciliação aproximada: criados vs terminais nas últimas 24h (não prova exactidão 1:1). */
    reconciliation_24h: {
      created: created24h,
      terminal: terminal24h,
      open_backlog: pending + processing,
      failed_open_total: failedOpen,
      /** true se ainda há trabalho aberto ou falhas acumuladas a investigar */
      needs_attention: pending + processing > 0 || failedOpen > 0,
    },
    oldest_pending_age_s: oldestPending
      ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / 1000)
      : null,
    soft_backpressure_active: pending + processing >= PENDING_SOFT_MAX,
    global_slots_used: processing,
    global_slots_free: Math.max(0, GLOBAL_CONCURRENCY - processing),
  };
}

export function newComplianceWorkerId(prefix = "worker"): string {
  return `${prefix}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

/** Cache de backlog para não COUNT(*) em cada enqueue. */
let backlogCache = { at: 0, n: 0 };
async function getCachedBacklog(): Promise<number> {
  if (Date.now() - backlogCache.at < 2000) return backlogCache.n;
  try {
    const n = await systemPrisma.presellComplianceJob.count({
      where: { status: { in: ["pending", "processing"] } },
    });
    backlogCache = { at: Date.now(), n };
    return n;
  } catch {
    return backlogCache.n;
  }
}

/**
 * Alertas operacionais (fila compliance, worker, backup, integrações).
 * Entrega via OPS_ALERT_WEBHOOK_URL com cooldown por `kind` — sem PII/tokens.
 */
import { createHash } from "node:crypto";

export type OpsAlertKind =
  | "compliance_queue_backlog"
  | "compliance_jobs_failed"
  | "compliance_worker_offline_suspect"
  | "backup_failed"
  | "integration_persistent_error"
  | "api_5xx"
  | "unattributed_sale"
  | "ops_alert_test";

export type ComplianceQueueAlertSnapshot = {
  pending?: number;
  processing?: number;
  failed_24h?: number;
  completed_24h?: number;
  oldest_pending_age_s?: number | null;
  soft_backpressure_active?: boolean;
  reconciliation_24h?: {
    created?: number;
    terminal?: number;
    open_backlog?: number;
    failed_open_total?: number;
    needs_attention?: boolean;
  };
  status?: string;
};

const lastAlertByKind = new Map<string, number>();

function cooldownMs(): number {
  return Math.max(
    1_000,
    Math.min(3_600_000, Number(process.env.OPS_ALERT_COOLDOWN_MS || String(5 * 60_000)) || 5 * 60_000),
  );
}

/** Idade mínima do pending para alertar backlog (s). */
function backlogAgeS(): number {
  return Math.max(30, Number(process.env.OPS_ALERT_BACKLOG_AGE_S || "300") || 300);
}

/** Pending>0, processing=0 e idade ≥ isto → suspeita de worker offline. */
function workerOfflineAgeS(): number {
  return Math.max(30, Number(process.env.OPS_ALERT_WORKER_OFFLINE_AGE_S || "600") || 600);
}

export function resetOpsAlertCooldownsForTests(): void {
  lastAlertByKind.clear();
}

export function opsAlertCooldownMs(): number {
  return cooldownMs();
}

/** Hash curto estável para correlacionar sem expor IDs completos. */
export function shortOpaqueId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export async function sendOpsAlert(
  kind: OpsAlertKind | string,
  payload: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "skipped_no_url" | "skipped_cooldown" | "failed"> {
  const url = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (!url) return "skipped_no_url";

  const now = Date.now();
  const last = lastAlertByKind.get(kind) ?? 0;
  if (now - last < cooldownMs()) return "skipped_cooldown";
  lastAlertByKind.set(kind, now);

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "dclickora",
        kind,
        at: new Date().toISOString(),
        ...payload,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn("[ops.alert] delivery non-ok", kind, res.status);
      return "failed";
    }
    console.info("[ops.alert] sent", kind);
    return "sent";
  } catch (e) {
    console.warn("[ops.alert] delivery failed:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

/**
 * Avalia snapshot da fila e dispara alertas (idempotente sob cooldown).
 * Não inventa estado — só reage a campos presentes.
 */
export async function evaluateComplianceQueueAlerts(
  snap: ComplianceQueueAlertSnapshot,
  send: typeof sendOpsAlert = sendOpsAlert,
): Promise<Array<{ kind: OpsAlertKind; result: string }>> {
  const out: Array<{ kind: OpsAlertKind; result: string }> = [];
  if (!snap || snap.status === "warming" || snap.status === "error") return out;

  const pending = Number(snap.pending ?? 0);
  const processing = Number(snap.processing ?? 0);
  const age = snap.oldest_pending_age_s == null ? null : Number(snap.oldest_pending_age_s);
  const failed24 = Number(snap.failed_24h ?? 0);
  const failedOpen = Number(snap.reconciliation_24h?.failed_open_total ?? 0);
  const needsAttention = Boolean(snap.reconciliation_24h?.needs_attention);
  const soft = Boolean(snap.soft_backpressure_active);

  if (
    (needsAttention || soft || pending > 0) &&
    age != null &&
    age >= backlogAgeS()
  ) {
    const result = await send("compliance_queue_backlog", {
      pending,
      processing,
      oldest_pending_age_s: age,
      soft_backpressure_active: soft,
      open_backlog: snap.reconciliation_24h?.open_backlog ?? pending + processing,
    });
    out.push({ kind: "compliance_queue_backlog", result });
  }

  if (failed24 > 0 || failedOpen > 0) {
    const result = await send("compliance_jobs_failed", {
      failed_24h: failed24,
      failed_open_total: failedOpen,
    });
    out.push({ kind: "compliance_jobs_failed", result });
  }

  if (pending > 0 && processing === 0 && age != null && age >= workerOfflineAgeS()) {
    const result = await send("compliance_worker_offline_suspect", {
      pending,
      oldest_pending_age_s: age,
      note: "pending>0 processing=0 — verificar serviço clickora-compliance-worker",
    });
    out.push({ kind: "compliance_worker_offline_suspect", result });
  }

  return out;
}

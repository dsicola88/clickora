/**
 * Ledger canónico de vendas: tabela `conversions`.
 *
 * Regras (FASE 1):
 * - Conversion = única fonte de receita / comissões / contagem de vendas aprovadas.
 * - TrackingEvent(conversion|sale) = telemetria / diagnóstico — nunca receita paralela.
 * - Deduplicação estável via `@@unique([userId, externalOrderId])`.
 * - Postbacks repetidos e races P2002 → duplicate (sem receita extra).
 * - Reembolsos / cancelamentos actualizam status/amount; histórico fica em metadata.
 */
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

/** Prefixo de externalOrderId para import Offline CSV (GCLID). */
export const OFFLINE_CSV_EXTERNAL_PREFIX = "offline_csv:";

/** Extrai GCLID de Conversion (metadata do clique ou do próprio postback ads). */
export function gclidFromConversionRow(c: {
  metadata?: Prisma.JsonValue | null;
  click?: { metadata?: Prisma.JsonValue | null } | null;
}): string {
  const clickMeta = (c.click?.metadata || {}) as Record<string, unknown>;
  const ownMeta = (c.metadata || {}) as Record<string, unknown>;
  for (const m of [clickMeta, ownMeta]) {
    const g = typeof m.gclid === "string" ? m.gclid.trim() : "";
    if (g) return g;
  }
  return "";
}

/** Identidade estável de dedupe para uma linha Offline CSV (1 venda / GCLID / conta). */
export function offlineCsvExternalOrderId(gclid: string): string {
  const g = gclid.trim();
  return `${OFFLINE_CSV_EXTERNAL_PREFIX}csv_gclid:${g}`.slice(0, 190);
}

/** Transaction id em TE telemetria (histórico) — alinhado ao externalOrderId sem o prefixo de namespace. */
export function offlineCsvTelemetryTransactionId(gclid: string): string {
  return `csv_gclid:${gclid.trim()}`;
}

export type OfflineImportRow = {
  conversionId: string;
  gclid: string;
  at: Date;
  value: number;
  currency: string;
};

/** Linhas para import Google Ads Offline — só `Conversion` aprovadas com GCLID. */
export async function listApprovedConversionsWithGclid(args: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  conversionIds?: string[] | null;
}): Promise<OfflineImportRow[]> {
  const where: Prisma.ConversionWhereInput = {
    userId: args.userId,
    status: "approved",
    createdAt: { gte: args.rangeStart, lte: args.rangeEnd },
    ...(args.conversionIds?.length ? { id: { in: args.conversionIds } } : {}),
  };
  const sales = await systemPrisma.conversion.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      amount: true,
      currency: true,
      metadata: true,
      click: { select: { metadata: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const out: OfflineImportRow[] = [];
  for (const c of sales) {
    const gclid = gclidFromConversionRow(c);
    if (!gclid) continue;
    out.push({
      conversionId: c.id,
      gclid,
      at: c.createdAt,
      value: c.amount != null ? Number(c.amount) : 0,
      currency: (c.currency || "USD").toUpperCase().slice(0, 3),
    });
  }
  return out;
}

/**
 * Totais financeiros canónicos — a mesma definição que dashboard / listConversions / CSV export.
 * Só `status = 'approved'`; refunded/pending excluídos da receita.
 */
export async function sumApprovedConversionTotals(args: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  campaign?: string | null;
  presellId?: string | null;
}): Promise<{ count: number; revenue: number }> {
  const where: Prisma.ConversionWhereInput = {
    userId: args.userId,
    status: "approved",
    createdAt: { gte: args.rangeStart, lte: args.rangeEnd },
    ...(args.campaign ? { campaign: args.campaign } : {}),
    ...(args.presellId ? { presellId: args.presellId } : {}),
  };
  const agg = await systemPrisma.conversion.aggregate({
    where,
    _count: { _all: true },
    _sum: { amount: true },
  });
  return {
    count: agg._count._all,
    revenue: agg._sum.amount != null ? Number(agg._sum.amount) : 0,
  };
}

/**
 * Cria Conversion a partir de import Offline CSV (fonte canónica).
 * Idempotente por `externalOrderId = offline_csv:csv_gclid:{gclid}`.
 */
export async function upsertConversionFromOfflineCsv(args: {
  userId: string;
  presellId: string;
  clickId: string | null;
  amount: number;
  currency?: string;
  campaign?: string | null;
  gclid: string;
  tx?: Prisma.TransactionClient;
}): Promise<{ conversionId: string; created: boolean; duplicate: boolean }> {
  const db = args.tx ?? systemPrisma;
  const externalOrderId = offlineCsvExternalOrderId(args.gclid);
  const existing = await db.conversion.findFirst({
    where: { userId: args.userId, externalOrderId },
    select: { id: true },
  });
  if (existing) {
    return { conversionId: existing.id, created: false, duplicate: true };
  }

  const attribution = args.clickId ? "attributed" : "unattributed";
  const metadata: Prisma.InputJsonValue = {
    postback_origin: "offline_csv",
    gclid: args.gclid.trim(),
    ledger: "canonical_offline_csv",
    transaction_id: offlineCsvTelemetryTransactionId(args.gclid),
  };

  try {
    const created = await db.conversion.create({
      data: {
        userId: args.userId,
        presellId: args.presellId,
        clickId: args.clickId,
        campaign: args.campaign ?? undefined,
        amount: new Prisma.Decimal(args.amount),
        currency: (args.currency || "USD").toUpperCase().slice(0, 8),
        status: "approved",
        attribution,
        externalOrderId,
        googleAdsSync: "skipped_offline_csv_import",
        metaCapiSync: "skipped_offline_csv_import",
        tiktokEventsSync: "skipped_offline_csv_import",
        metadata,
      },
      select: { id: true },
    });
    return { conversionId: created.id, created: true, duplicate: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.conversion.findFirst({
        where: { userId: args.userId, externalOrderId },
        select: { id: true },
      });
      if (again) return { conversionId: again.id, created: false, duplicate: true };
    }
    throw e;
  }
}

/**
 * Máquina de estados financeira (pura) — documenta transições válidas do ledger.
 * Usada em testes; a API aplica a mesma semântica via integrations.controller.
 */
export type LedgerStatus = "pending" | "approved" | "refunded";

export type LedgerTransitionEvent =
  | { kind: "approve" }
  | { kind: "cancel" }
  | { kind: "refund"; mode: "full" | "partial"; refundAmount?: number | null }
  | { kind: "restate"; amount: number };

export type LedgerRowSnapshot = {
  status: LedgerStatus;
  amount: number;
};

export function applyLedgerTransition(
  row: LedgerRowSnapshot,
  event: LedgerTransitionEvent,
): LedgerRowSnapshot {
  if (event.kind === "approve") {
    if (row.status === "pending") return { status: "approved", amount: row.amount };
    return row;
  }
  if (event.kind === "cancel") {
    if (row.status === "pending") return { status: "refunded", amount: row.amount };
    return row;
  }
  if (event.kind === "refund") {
    if (row.status === "pending") return { status: "refunded", amount: row.amount };
    if (row.status !== "approved") return row;
    if (event.mode === "partial" && event.refundAmount != null && event.refundAmount > 0) {
      const next = Math.max(0, row.amount - event.refundAmount);
      return { status: "approved", amount: next };
    }
    return { status: "refunded", amount: row.amount };
  }
  if (event.kind === "restate") {
    if (row.status === "approved" || row.status === "pending") {
      return { status: row.status, amount: event.amount };
    }
  }
  return row;
}

/** Receita contabilizada: só approved. */
export function revenueFromLedgerRows(rows: LedgerRowSnapshot[]): number {
  return rows
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + r.amount, 0);
}

/**
 * Reconciliação: conta TE(conversion) vs Conversion no período.
 * `ok` se não houver TE ads/csv órfãos sem Conversion com mesmo external namespace.
 */
export async function reconcileConversionLedger(args: {
  userId: string;
  since: Date;
}): Promise<{
  conversion_approved: number;
  tracking_event_conversions: number;
  conversion_with_ads_origin: number;
  te_with_ads_origin: number;
  conversion_offline_csv: number;
  te_offline_csv: number;
  te_offline_csv_orphans: number;
  ledger_aligned: boolean;
  note: string;
}> {
  const [
    conversion_approved,
    tracking_event_conversions,
    convAds,
    teAds,
    convCsv,
    teCsv,
    orphanScan,
  ] = await Promise.all([
    systemPrisma.conversion.count({
      where: { userId: args.userId, status: "approved", createdAt: { gte: args.since } },
    }),
    systemPrisma.trackingEvent.count({
      where: { userId: args.userId, eventType: "conversion", createdAt: { gte: args.since } },
    }),
    systemPrisma.conversion.count({
      where: {
        userId: args.userId,
        createdAt: { gte: args.since },
        OR: [
          { externalOrderId: { startsWith: "google_ads:" } },
          { externalOrderId: { startsWith: "microsoft_ads:" } },
        ],
      },
    }),
    systemPrisma.trackingEvent.count({
      where: {
        userId: args.userId,
        eventType: "conversion",
        createdAt: { gte: args.since },
        OR: [
          { metadata: { path: ["postback_origin"], equals: "google_ads" } },
          { metadata: { path: ["postback_origin"], equals: "microsoft_ads" } },
        ],
      },
    }),
    systemPrisma.conversion.count({
      where: {
        userId: args.userId,
        createdAt: { gte: args.since },
        externalOrderId: { startsWith: OFFLINE_CSV_EXTERNAL_PREFIX },
      },
    }),
    systemPrisma.trackingEvent.count({
      where: {
        userId: args.userId,
        eventType: "conversion",
        createdAt: { gte: args.since },
        metadata: { path: ["postback_origin"], equals: "offline_csv" },
      },
    }),
    findOrphanOfflineCsvTrackingEvents({
      userId: args.userId,
      since: args.since,
      limit: 10_000,
    }),
  ]);

  const te_offline_csv_orphans = orphanScan.length;
  const adsOk = teAds === 0 || convAds >= teAds;
  const csvOk = te_offline_csv_orphans === 0;
  const ledger_aligned = adsOk && csvOk;
  return {
    conversion_approved,
    tracking_event_conversions,
    conversion_with_ads_origin: convAds,
    te_with_ads_origin: teAds,
    conversion_offline_csv: convCsv,
    te_offline_csv: teCsv,
    te_offline_csv_orphans,
    ledger_aligned,
    note: ledger_aligned
      ? "Receita canónica = Conversion; TE(conversion) é telemetria."
      : te_offline_csv_orphans > 0
        ? `Há ${te_offline_csv_orphans} TE offline_csv sem Conversion — correr backfillOfflineCsvTeToConversions.`
        : "Há TE ads sem Conversion correspondente — investigar postbacks.",
  };
}

export type OrphanOfflineCsvTe = {
  teId: string;
  userId: string;
  presellPageId: string | null;
  gclid: string;
  amount: number;
  currency: string;
  createdAt: Date;
};

/** TE offline_csv legados sem Conversion com a mesma chave GCLID. */
export async function findOrphanOfflineCsvTrackingEvents(args: {
  userId?: string;
  since?: Date;
  limit?: number;
}): Promise<OrphanOfflineCsvTe[]> {
  const limit = Math.min(Math.max(args.limit ?? 2000, 1), 20_000);
  const rows = await systemPrisma.trackingEvent.findMany({
    where: {
      eventType: "conversion",
      ...(args.userId ? { userId: args.userId } : {}),
      ...(args.since ? { createdAt: { gte: args.since } } : {}),
      metadata: { path: ["postback_origin"], equals: "offline_csv" },
    },
    select: {
      id: true,
      userId: true,
      presellPageId: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const candidates: OrphanOfflineCsvTe[] = [];
  const externalByUser = new Map<string, Set<string>>();

  for (const te of rows) {
    const meta = (te.metadata || {}) as Record<string, unknown>;
    const gclid = typeof meta.gclid === "string" ? meta.gclid.trim() : "";
    if (!gclid) continue;
    const rawVal = meta.value;
    const amount =
      typeof rawVal === "number"
        ? rawVal
        : typeof rawVal === "string"
          ? Number.parseFloat(rawVal.replace(",", "."))
          : 0;
    const currency =
      typeof meta.currency === "string" && meta.currency.trim()
        ? meta.currency.trim().toUpperCase().slice(0, 8)
        : "USD";
    candidates.push({
      teId: te.id,
      userId: te.userId,
      presellPageId: te.presellPageId,
      gclid,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      createdAt: te.createdAt,
    });
    const ext = offlineCsvExternalOrderId(gclid);
    if (!externalByUser.has(te.userId)) externalByUser.set(te.userId, new Set());
    externalByUser.get(te.userId)!.add(ext);
  }

  if (candidates.length === 0) return [];

  const existing = new Set<string>();
  for (const [userId, extSet] of externalByUser) {
    const found = await systemPrisma.conversion.findMany({
      where: { userId, externalOrderId: { in: [...extSet] } },
      select: { userId: true, externalOrderId: true },
    });
    for (const row of found) {
      if (row.externalOrderId) existing.add(`${row.userId}\0${row.externalOrderId}`);
    }
  }

  return candidates.filter(
    (c) => !existing.has(`${c.userId}\0${offlineCsvExternalOrderId(c.gclid)}`),
  );
}

/**
 * Backfill one-shot: TE offline_csv órfãos → Conversion (mesma upsert canónica).
 * Idempotente; dryRun não escreve. Não inventa funil — só fecha o ledger.
 */
export async function backfillOfflineCsvTeToConversions(args?: {
  userId?: string;
  since?: Date;
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  scanned_orphans: number;
  created: number;
  skipped_no_presell: number;
  skipped_duplicate: number;
  dry_run: boolean;
}> {
  const dryRun = args?.dryRun !== false;
  const orphans = await findOrphanOfflineCsvTrackingEvents({
    userId: args?.userId,
    since: args?.since,
    limit: args?.limit,
  });

  let created = 0;
  let skipped_no_presell = 0;
  let skipped_duplicate = 0;

  /** Um GCLID por user — evita duplicar se vários TE órfãos partilham o mesmo gclid. */
  const seen = new Set<string>();

  for (const orphan of orphans) {
    const dedupeKey = `${orphan.userId}\0${orphan.gclid}`;
    if (seen.has(dedupeKey)) {
      skipped_duplicate++;
      continue;
    }
    seen.add(dedupeKey);

    if (!orphan.presellPageId) {
      skipped_no_presell++;
      continue;
    }

    if (dryRun) {
      created++;
      continue;
    }

    /** Clique mais recente com este GCLID (mesma regra do import CSV). */
    const click = await systemPrisma.trackingEvent.findFirst({
      where: {
        userId: orphan.userId,
        eventType: "click",
        metadata: { path: ["gclid"], equals: orphan.gclid },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, campaign: true },
    });

    const upserted = await upsertConversionFromOfflineCsv({
      userId: orphan.userId,
      presellId: orphan.presellPageId,
      clickId: click?.id ?? null,
      amount: orphan.amount,
      currency: orphan.currency,
      campaign: click?.campaign ?? null,
      gclid: orphan.gclid,
    });
    if (upserted.created) {
      created++;
      if (orphan.presellPageId) {
        await systemPrisma.presellPage.update({
          where: { id: orphan.presellPageId },
          data: { conversions: { increment: 1 } },
        });
      }
    } else {
      skipped_duplicate++;
    }
  }

  return {
    scanned_orphans: orphans.length,
    created,
    skipped_no_presell,
    skipped_duplicate,
    dry_run: dryRun,
  };
}

/**
 * Alinha o contador denormalizado `presell_pages.conversions` a COUNT(approved).
 * Refunds / CSV / ads podem ter deixado o contador desalinhado.
 */
export async function reconcilePresellPageConversionCounters(args?: {
  userId?: string;
  dryRun?: boolean;
}): Promise<{
  pages_checked: number;
  pages_mismatched: number;
  dry_run: boolean;
  samples: Array<{ pageId: string; stored: number; actual: number }>;
}> {
  const dryRun = args?.dryRun !== false;
  const pages = await systemPrisma.presellPage.findMany({
    where: args?.userId ? { userId: args.userId } : {},
    select: { id: true, conversions: true },
  });

  const samples: Array<{ pageId: string; stored: number; actual: number }> = [];
  let pages_mismatched = 0;

  for (const page of pages) {
    const actual = await systemPrisma.conversion.count({
      where: { presellId: page.id, status: "approved" },
    });
    if (actual === page.conversions) continue;
    pages_mismatched++;
    if (samples.length < 25) {
      samples.push({ pageId: page.id, stored: page.conversions, actual });
    }
    if (!dryRun) {
      await systemPrisma.presellPage.update({
        where: { id: page.id },
        data: { conversions: actual },
      });
    }
  }

  return {
    pages_checked: pages.length,
    pages_mismatched,
    dry_run: dryRun,
    samples,
  };
}

/**
 * Ledger canónico de vendas: tabela `conversions`.
 * TrackingEvent(conversion) é telemetria / histórico de postback ads — não fonte de receita.
 */
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

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
 * Reconciliação: conta TE(conversion) vs Conversion no período.
 * `ok` se não houver TE ads órfãos sem Conversion com mesmo external namespace
 * (heurística: diferença absoluta reportada; alertar se teAds > 0 && convAds == 0).
 */
export async function reconcileConversionLedger(args: {
  userId: string;
  since: Date;
}): Promise<{
  conversion_approved: number;
  tracking_event_conversions: number;
  conversion_with_ads_origin: number;
  te_with_ads_origin: number;
  ledger_aligned: boolean;
  note: string;
}> {
  const [conversion_approved, tracking_event_conversions, convAds, teAds] = await Promise.all([
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
  ]);

  /** Alinhado quando cada postback ads tem Conversion (teAds ≈ convAds; TE pode = Conversion). */
  const ledger_aligned = teAds === 0 || convAds >= teAds;
  return {
    conversion_approved,
    tracking_event_conversions,
    conversion_with_ads_origin: convAds,
    te_with_ads_origin: teAds,
    ledger_aligned,
    note: ledger_aligned
      ? "Receita canónica = Conversion; TE(conversion) é telemetria."
      : "Há TE ads sem Conversion correspondente — investigar postbacks.",
  };
}

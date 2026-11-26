import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

/** Falhas / skips de upload Ads em conversões aprovadas — contrato FE SyncHealthBanner. */
export type SyncHealth = {
  period_days: number;
  google_ads_failed: number;
  google_ads_skipped_no_gclid: number;
  meta_capi_failed: number;
  meta_capi_skipped_no_fbclid: number;
  tiktok_events_failed: number;
  tiktok_events_skipped_no_ttclid: number;
};

export function emptySyncHealth(periodDays: number): SyncHealth {
  return {
    period_days: periodDays,
    google_ads_failed: 0,
    google_ads_skipped_no_gclid: 0,
    meta_capi_failed: 0,
    meta_capi_skipped_no_fbclid: 0,
    tiktok_events_failed: 0,
    tiktok_events_skipped_no_ttclid: 0,
  };
}

export function syncHealthIssueTotal(sh: SyncHealth): number {
  return (
    sh.google_ads_failed +
    sh.google_ads_skipped_no_gclid +
    sh.meta_capi_failed +
    sh.meta_capi_skipped_no_fbclid +
    sh.tiktok_events_failed +
    sh.tiktok_events_skipped_no_ttclid
  );
}

/**
 * «Sem ID» só é acionável quando a venda veio de um clique dessa rede (ex.: Google Ads sem gclid
 * = etiquetagem automática desligada). Vendas orgânicas, diretas ou de outras redes nunca teriam
 * esse ID e não contam como erro.
 */
const GOOGLE_ORIGIN_SQL = Prisma.sql`(te.source ~* 'google' OR te.metadata->>'utm_source' ~* 'google')`;
const META_ORIGIN_SQL = Prisma.sql`(te.source ~* '(facebook|instagram|^meta$|^fb$)' OR te.metadata->>'utm_source' ~* '(facebook|instagram|^meta$|^fb$)')`;
const TIKTOK_ORIGIN_SQL = Prisma.sql`(te.source ~* 'tiktok' OR te.metadata->>'utm_source' ~* 'tiktok')`;

/** Contagens de envio Google/Meta/TikTok desde `since` (inclusive). */
export async function loadSyncHealth(args: {
  userId: string;
  since: Date;
  periodDays: number;
}): Promise<SyncHealth> {
  const { userId, since, periodDays } = args;
  try {
    const [sh] = await systemPrisma.$queryRaw<
      Array<{
        g: bigint | null;
        gclid: bigint | null;
        m: bigint | null;
        fbclid: bigint | null;
        t: bigint | null;
        ttclid: bigint | null;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE c.google_ads_sync = 'failed')::bigint AS g,
        COUNT(*) FILTER (WHERE c.google_ads_sync = 'skipped_no_gclid' AND ${GOOGLE_ORIGIN_SQL})::bigint AS gclid,
        COUNT(*) FILTER (WHERE c.meta_capi_sync = 'failed')::bigint AS m,
        COUNT(*) FILTER (WHERE c.meta_capi_sync = 'skipped_no_fbclid' AND ${META_ORIGIN_SQL})::bigint AS fbclid,
        COUNT(*) FILTER (WHERE c.tiktok_events_sync = 'failed')::bigint AS t,
        COUNT(*) FILTER (WHERE c.tiktok_events_sync = 'skipped_no_ttclid' AND ${TIKTOK_ORIGIN_SQL})::bigint AS ttclid
      FROM conversions c
      LEFT JOIN tracking_events te ON te.id = c.click_id
      WHERE c.user_id = ${userId}
        AND c.status = 'approved'
        AND c.created_at >= ${since}
    `);
    return {
      period_days: periodDays,
      google_ads_failed: Number(sh?.g ?? 0),
      google_ads_skipped_no_gclid: Number(sh?.gclid ?? 0),
      meta_capi_failed: Number(sh?.m ?? 0),
      meta_capi_skipped_no_fbclid: Number(sh?.fbclid ?? 0),
      tiktok_events_failed: Number(sh?.t ?? 0),
      tiktok_events_skipped_no_ttclid: Number(sh?.ttclid ?? 0),
    };
  } catch (e) {
    console.warn("[syncHealth] colunas ou BD indisponíveis", e);
    return emptySyncHealth(periodDays);
  }
}

/** Observabilidade da fila `conversion_sync_jobs` (não inventa envios). */
export type SyncQueueHealth = {
  period_days: number;
  pending: number;
  processing: number;
  dead: number;
  sent: number;
  by_channel: {
    google_ads: { pending: number; dead: number };
    meta_capi: { pending: number; dead: number };
    tiktok_events: { pending: number; dead: number };
  };
};

export function emptySyncQueueHealth(periodDays: number): SyncQueueHealth {
  return {
    period_days: periodDays,
    pending: 0,
    processing: 0,
    dead: 0,
    sent: 0,
    by_channel: {
      google_ads: { pending: 0, dead: 0 },
      meta_capi: { pending: 0, dead: 0 },
      tiktok_events: { pending: 0, dead: 0 },
    },
  };
}

export async function loadSyncQueueHealth(args: {
  userId: string;
  since: Date;
  periodDays: number;
}): Promise<SyncQueueHealth> {
  const { userId, since, periodDays } = args;
  try {
    const rows = await systemPrisma.conversionSyncJob.groupBy({
      by: ["channel", "status"],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const out = emptySyncQueueHealth(periodDays);
    for (const row of rows) {
      const n = row._count._all;
      const ch = row.channel as keyof SyncQueueHealth["by_channel"];
      if (row.status === "pending") out.pending += n;
      if (row.status === "processing") out.processing += n;
      if (row.status === "dead") out.dead += n;
      if (row.status === "sent") out.sent += n;
      if (ch in out.by_channel) {
        if (row.status === "pending") out.by_channel[ch].pending += n;
        if (row.status === "dead") out.by_channel[ch].dead += n;
      }
    }
    return out;
  } catch (e) {
    console.warn("[syncHealth] fila conversion_sync_jobs indisponível", e);
    return emptySyncQueueHealth(periodDays);
  }
}

/** Texto curto para account_health quando há issues. */
export function formatSyncHealthDetail(sh: SyncHealth): string {
  const parts: string[] = [];
  if (sh.google_ads_failed > 0) parts.push(`${sh.google_ads_failed} falha(s) Google Ads`);
  if (sh.google_ads_skipped_no_gclid > 0) {
    parts.push(`${sh.google_ads_skipped_no_gclid} sem ID Google (não enviadas)`);
  }
  if (sh.meta_capi_failed > 0) parts.push(`${sh.meta_capi_failed} falha(s) Meta CAPI`);
  if (sh.meta_capi_skipped_no_fbclid > 0) {
    parts.push(`${sh.meta_capi_skipped_no_fbclid} sem ID Meta (não enviadas)`);
  }
  if (sh.tiktok_events_failed > 0) parts.push(`${sh.tiktok_events_failed} falha(s) TikTok`);
  if (sh.tiktok_events_skipped_no_ttclid > 0) {
    parts.push(`${sh.tiktok_events_skipped_no_ttclid} sem ID TikTok (não enviadas)`);
  }
  return parts.length
    ? `Últimos ${sh.period_days}d: ${parts.join(" · ")}. Confirme auto-tagging e a URL do anúncio (sem gclid={gclid}).`
    : `Últimos ${sh.period_days}d: envios para anúncios OK.`;
}

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
        COUNT(*) FILTER (WHERE google_ads_sync = 'failed')::bigint AS g,
        COUNT(*) FILTER (WHERE google_ads_sync = 'skipped_no_gclid')::bigint AS gclid,
        COUNT(*) FILTER (WHERE meta_capi_sync = 'failed')::bigint AS m,
        COUNT(*) FILTER (WHERE meta_capi_sync = 'skipped_no_fbclid')::bigint AS fbclid,
        COUNT(*) FILTER (WHERE tiktok_events_sync = 'failed')::bigint AS t,
        COUNT(*) FILTER (WHERE tiktok_events_sync = 'skipped_no_ttclid')::bigint AS ttclid
      FROM conversions
      WHERE user_id = ${userId}
        AND status = 'approved'
        AND created_at >= ${since}
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

/** Texto curto para account_health quando há issues. */
export function formatSyncHealthDetail(sh: SyncHealth): string {
  const parts: string[] = [];
  if (sh.google_ads_failed > 0) parts.push(`${sh.google_ads_failed} falha(s) Google Ads`);
  if (sh.google_ads_skipped_no_gclid > 0) {
    parts.push(`${sh.google_ads_skipped_no_gclid} sem gclid`);
  }
  if (sh.meta_capi_failed > 0) parts.push(`${sh.meta_capi_failed} falha(s) Meta CAPI`);
  if (sh.meta_capi_skipped_no_fbclid > 0) {
    parts.push(`${sh.meta_capi_skipped_no_fbclid} sem fbclid`);
  }
  if (sh.tiktok_events_failed > 0) parts.push(`${sh.tiktok_events_failed} falha(s) TikTok`);
  if (sh.tiktok_events_skipped_no_ttclid > 0) {
    parts.push(`${sh.tiktok_events_skipped_no_ttclid} sem ttclid`);
  }
  return parts.length
    ? `Últimos ${sh.period_days}d: ${parts.join(" · ")}.`
    : `Últimos ${sh.period_days}d: envios para anúncios OK.`;
}

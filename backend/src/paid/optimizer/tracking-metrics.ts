/**
 * Métricas agregadas a partir do tracking (tracking_events + conversions) —
 * chave de ligação à campanha Paid: metadata.paid_ads_campaign_id ou coluna campaign = UUID da campanha.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "../paidPrisma";

export type TrackingCampaignMetrics = {
  clicks: number;
  impressions: number;
  conversionEvents: number;
  approvedConversions: number;
  revenueUsd: number;
};

export async function aggregateTrackingMetricsForCampaign(args: {
  userId: string;
  campaignId: string;
  since: Date;
}): Promise<TrackingCampaignMetrics> {
  const { userId, campaignId, since } = args;

  const raw = await prisma.$queryRaw<
    {
      clicks: bigint;
      impressions: bigint;
      conversion_events: bigint;
      approved_conversions: bigint;
      revenue_usd: unknown;
    }[]
  >(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE te.event_type::text = 'click')::bigint AS clicks,
      COUNT(*) FILTER (WHERE te.event_type::text = 'impression')::bigint AS impressions,
      COUNT(*) FILTER (WHERE te.event_type::text IN ('conversion', 'sale'))::bigint AS conversion_events,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM conversions c
        INNER JOIN tracking_events te2 ON te2.id = c.click_id
        WHERE c.user_id = ${userId}::uuid
          AND c.created_at >= ${since}
          AND c.status = 'approved'
          AND (
            (te2.metadata->>'paid_ads_campaign_id') = ${campaignId}
            OR te2.campaign = ${campaignId}
          )
      ), 0::bigint) AS approved_conversions,
      COALESCE((
        SELECT SUM(COALESCE(c.amount, 0))::decimal
        FROM conversions c
        INNER JOIN tracking_events te2 ON te2.id = c.click_id
        WHERE c.user_id = ${userId}::uuid
          AND c.created_at >= ${since}
          AND c.status = 'approved'
          AND (
            (te2.metadata->>'paid_ads_campaign_id') = ${campaignId}
            OR te2.campaign = ${campaignId}
          )
      ), 0::decimal) AS revenue_usd
    FROM tracking_events te
    WHERE te.user_id = ${userId}::uuid
      AND te.created_at >= ${since}
      AND (
        (te.metadata->>'paid_ads_campaign_id') = ${campaignId}
        OR te.campaign = ${campaignId}
      )
  `);

  const row = raw[0];
  if (!row) {
    return {
      clicks: 0,
      impressions: 0,
      conversionEvents: 0,
      approvedConversions: 0,
      revenueUsd: 0,
    };
  }

  const revenueUsd = Number(row.revenue_usd ?? 0);

  return {
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    conversionEvents: Number(row.conversion_events),
    approvedConversions: Number(row.approved_conversions),
    revenueUsd: Number.isFinite(revenueUsd) ? revenueUsd : 0,
  };
}

/** CTR derivado do tracking (cliques / impressões). */
export function ctrFromTracking(m: TrackingCampaignMetrics): number | null {
  if (m.impressions <= 0) return null;
  return m.clicks / m.impressions;
}

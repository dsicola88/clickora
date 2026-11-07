/**
 * Métricas — tracking (fonte de verdade para conversões/cliques) + APIs de rede (gasto).
 * Fluxo: scheduler → optimizer.service → metrics.service → …
 */
import type { PaidAdsPlatform } from "@prisma/client";

import { prisma } from "../paidPrisma";
import { isOAuthPendingToken, loadPaidToken } from "../tokenSecrets";
import { fetchGoogleCampaignCostMicros } from "./google-metrics";
import { optimizerLog } from "./logger";
import { fetchMetaCampaignSpendUsd } from "./meta-metrics";
import { fetchTikTokCampaignSpendUsd } from "./tiktok-metrics";
import { aggregateTrackingMetricsForCampaign, type TrackingCampaignMetrics } from "./tracking-metrics";

export type CampaignMetricsBundle = {
  tracking: TrackingCampaignMetrics;
  googleCostMicros: number | null;
  metaSpendUsd: number | null;
  tiktokSpendUsd: number | null;
  spendUsdPlatform: number | null;
};

export function resolveSpendUsd(args: {
  platform: PaidAdsPlatform;
  googleCostMicros: number | null;
  metaSpendUsd: number | null;
  tiktokSpendUsd: number | null;
}): number | null {
  if (args.platform === "google_ads") {
    return args.googleCostMicros !== null ? args.googleCostMicros / 1_000_000 : null;
  }
  if (args.platform === "meta_ads") {
    return args.metaSpendUsd;
  }
  if (args.platform === "tiktok_ads") {
    return args.tiktokSpendUsd;
  }
  return null;
}

export async function collectCampaignMetricsBundle(args: {
  projectId: string;
  userId: string;
  campaignId: string;
  platform: PaidAdsPlatform;
  externalCampaignId: string | null;
  since: Date;
  to: Date;
  trace?: { tickId?: string };
}): Promise<CampaignMetricsBundle> {
  const trace = args.trace ?? {};

  const tracking = await aggregateTrackingMetricsForCampaign({
    userId: args.userId,
    campaignId: args.campaignId,
    since: args.since,
  });

  let googleCostMicros: number | null = null;
  if (args.platform === "google_ads" && args.externalCampaignId) {
    try {
      const g = await fetchGoogleCampaignCostMicros({
        projectId: args.projectId,
        externalCampaignId: args.externalCampaignId,
        from: args.since,
        to: args.to,
      });
      googleCostMicros = g.ok ? g.costMicros : null;
      if (!g.ok) {
        optimizerLog("warn", "google_cost_fetch_failed", {
          ...trace,
          projectId: args.projectId,
          campaignId: args.campaignId,
          detail: "GAQL/spend não disponível neste ciclo — regra de gasto pode ficar sem dados.",
        });
      }
    } catch (e) {
      optimizerLog("warn", "google_cost_fetch_exception", {
        ...trace,
        projectId: args.projectId,
        campaignId: args.campaignId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let metaSpendUsd: number | null = null;
  if (args.platform === "meta_ads" && args.externalCampaignId) {
    try {
      const conn = await prisma.paidAdsMetaConnection.findUnique({ where: { projectId: args.projectId } });
      const plain =
        conn?.tokenRef && !isOAuthPendingToken(conn.tokenRef)
          ? loadPaidToken(conn.tokenRef)
          : null;
      if (conn?.status === "connected" && plain) {
        const m = await fetchMetaCampaignSpendUsd({
          accessToken: plain,
          externalCampaignId: args.externalCampaignId,
        });
        metaSpendUsd = m.ok ? m.spendUsd : null;
        if (!m.ok) {
          optimizerLog("warn", "meta_spend_fetch_failed", {
            ...trace,
            projectId: args.projectId,
            campaignId: args.campaignId,
            detail: "Insights Meta indisponíveis — gasto por plataforma omitido.",
          });
        }
      }
    } catch (e) {
      optimizerLog("warn", "meta_spend_fetch_exception", {
        ...trace,
        projectId: args.projectId,
        campaignId: args.campaignId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  let tiktokSpendUsd: number | null = null;
  if (args.platform === "tiktok_ads" && args.externalCampaignId) {
    try {
      const t = await fetchTikTokCampaignSpendUsd({
        projectId: args.projectId,
        externalCampaignId: args.externalCampaignId,
        from: args.since,
        to: args.to,
      });
      tiktokSpendUsd = t.ok ? t.spendUsd : null;
      if (!t.ok) {
        optimizerLog("warn", "tiktok_spend_fetch_failed", {
          ...trace,
          projectId: args.projectId,
          campaignId: args.campaignId,
          detail: t.error,
        });
      }
    } catch (e) {
      optimizerLog("warn", "tiktok_spend_fetch_exception", {
        ...trace,
        projectId: args.projectId,
        campaignId: args.campaignId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const spendUsdPlatform = resolveSpendUsd({
    platform: args.platform,
    googleCostMicros,
    metaSpendUsd,
    tiktokSpendUsd,
  });

  return { tracking, googleCostMicros, metaSpendUsd, tiktokSpendUsd, spendUsdPlatform };
}

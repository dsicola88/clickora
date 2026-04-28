/**
 * Ciclo principal — scheduler → optimizer.service → metrics → rules → actions.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../paidPrisma";
import { executeOptimizerDecision } from "./actions.service";
import {
  enqueueBudgetScaledAlert,
  enqueueCampaignPausedAlert,
  enqueueOptimizerCriticalAlert,
} from "./alerts.service";
import { optimizerDryRun, optimizerEnabled, optimizerLookbackHours, resolveOptimizerPauseMinClicks, resolveOptimizerPauseSpendUsd } from "./config";
import { hasRecentSuccessfulDecision, shouldApplyIdempotencyCheck } from "./idempotency";
import { optimizerLog } from "./logger";
import { collectCampaignMetricsBundle, type CampaignMetricsBundle } from "./metrics.service";
import { evaluateOptimizerRules } from "./rules.engine";

export type OptimizerTickResult = {
  tickId: string;
  projectsScanned: number;
  campaignsEvaluated: number;
  /** Falha ao obter métricas (BD/API); campanha ignorada neste ciclo. */
  campaignsFailed: number;
  decisionsLogged: number;
  decisionsSucceeded: number;
  decisionsFailed: number;
  decisionsSkippedIdempotent: number;
  dryRun: boolean;
  durationMs: number;
};

export async function runPaidOptimizerTick(): Promise<OptimizerTickResult> {
  const dryRun = optimizerDryRun();
  const tickId = randomUUID();
  const t0 = Date.now();

  const result: OptimizerTickResult = {
    tickId,
    projectsScanned: 0,
    campaignsEvaluated: 0,
    campaignsFailed: 0,
    decisionsLogged: 0,
    decisionsSucceeded: 0,
    decisionsFailed: 0,
    decisionsSkippedIdempotent: 0,
    dryRun,
    durationMs: 0,
  };

  if (!optimizerEnabled()) {
    result.durationMs = Date.now() - t0;
    return result;
  }

  optimizerLog("info", "tick_start", {
    tickId,
    dryRun,
    lookbackHours: optimizerLookbackHours(),
    rulesPhase: process.env.PAID_OPTIMIZER_RULES?.trim() ? process.env.PAID_OPTIMIZER_RULES : "pause_only(default)",
  });

  const lookbackHours = optimizerLookbackHours();
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const to = new Date();

  try {
    const projects = await prisma.paidAdsProject.findMany({
      select: { id: true, userId: true },
    });

    for (const proj of projects) {
      const campaigns = await prisma.paidAdsCampaign.findMany({
        where: {
          projectId: proj.id,
          status: "live",
        },
      });

      if (campaigns.length === 0) continue;
      result.projectsScanned += 1;

      const grRow = await prisma.paidAdsGuardrails.findUnique({
        where: { projectId: proj.id },
        select: { optimizerPauseSpendUsd: true, optimizerPauseMinClicks: true },
      });
      const effPauseUsd = resolveOptimizerPauseSpendUsd(
        grRow?.optimizerPauseSpendUsd != null ? Number(grRow.optimizerPauseSpendUsd) : null,
      );
      const effPauseClicks = resolveOptimizerPauseMinClicks(grRow?.optimizerPauseMinClicks ?? null);

      for (const camp of campaigns) {
        result.campaignsEvaluated += 1;

        let bundle;
        try {
          bundle = await collectCampaignMetricsBundle({
            projectId: proj.id,
            userId: proj.userId,
            campaignId: camp.id,
            platform: camp.platform,
            externalCampaignId: camp.externalCampaignId,
            since,
            to,
            trace: { tickId },
          });
        } catch (e) {
          result.campaignsFailed += 1;
          optimizerLog("error", "campaign_metrics_failed", {
            tickId,
            projectId: proj.id,
            campaignId: camp.id,
            platform: camp.platform,
            error: e instanceof Error ? e.message : String(e),
          });
          continue;
        }

        const candidates = evaluateOptimizerRules({
          platform: camp.platform,
          tracking: bundle.tracking,
          spendUsdPlatform: bundle.spendUsdPlatform,
          effectivePauseSpendUsd: effPauseUsd,
          effectivePauseMinClicks: effPauseClicks,
        });

        if (candidates.length === 0) continue;

        for (const cand of candidates) {
          if (
            shouldApplyIdempotencyCheck({ decisionType: cand.decisionType, dryRun }) &&
            (await hasRecentSuccessfulDecision({
              campaignId: camp.id,
              ruleCode: cand.ruleCode,
              decisionType: cand.decisionType,
            }))
          ) {
            result.decisionsSkippedIdempotent += 1;
            optimizerLog("info", "decision_skipped_idempotent", {
              tickId,
              projectId: proj.id,
              campaignId: camp.id,
              ruleCode: cand.ruleCode,
              decisionType: cand.decisionType,
            });
            continue;
          }

          const row = await prisma.paidAdsOptimizerDecision.create({
            data: {
              projectId: proj.id,
              campaignId: camp.id,
              platform: camp.platform,
              ruleCode: cand.ruleCode,
              decisionType: cand.decisionType,
              dryRun,
              inputSnapshot: {
                ...cand.inputSnapshot,
                lookback_hours: lookbackHours,
                spend_usd_platform: bundle.spendUsdPlatform,
                reason: cand.reason,
                tick_id: tickId,
              },
              executed: false,
            },
          });

          result.decisionsLogged += 1;

          optimizerLog("info", "decision_executing", {
            tickId,
            projectId: proj.id,
            campaignId: camp.id,
            platform: camp.platform,
            ruleCode: cand.ruleCode,
            decisionType: cand.decisionType,
            dryRun,
          });

          const exec = await executeOptimizerDecision({
            projectId: proj.id,
            campaign: camp,
            candidate: cand,
            dryRun,
            trace: { tickId, decisionId: row.id },
          });

          await prisma.paidAdsOptimizerDecision.update({
            where: { id: row.id },
            data: {
              executed: true,
              executionOk: exec.ok,
              executionDetail: exec.detail.slice(0, 8000),
            },
          });

          if (exec.ok) {
            result.decisionsSucceeded += 1;
            optimizerLog("info", "decision_completed", {
              tickId,
              projectId: proj.id,
              campaignId: camp.id,
              ruleCode: cand.ruleCode,
              decisionType: cand.decisionType,
              dryRun,
              detailPreview: exec.detail.slice(0, 240),
            });
            if (!dryRun) {
              const metricsPayload = buildOptimizerAlertMetrics(bundle, lookbackHours);
              if (cand.decisionType === "pause_campaign") {
                enqueueCampaignPausedAlert({
                  tickId,
                  projectId: proj.id,
                  campaignId: camp.id,
                  platform: camp.platform,
                  reason: cand.reason,
                  metrics: metricsPayload,
                });
              } else if (cand.decisionType === "scale_budget") {
                enqueueBudgetScaledAlert({
                  tickId,
                  projectId: proj.id,
                  campaignId: camp.id,
                  platform: camp.platform,
                  reason: cand.reason,
                  metrics: metricsPayload,
                });
              }
            }
          } else {
            result.decisionsFailed += 1;
            optimizerLog("warn", "decision_failed", {
              tickId,
              projectId: proj.id,
              campaignId: camp.id,
              ruleCode: cand.ruleCode,
              decisionType: cand.decisionType,
              detailPreview: exec.detail.slice(0, 400),
            });
            if (
              !dryRun &&
              (cand.decisionType === "pause_campaign" || cand.decisionType === "scale_budget")
            ) {
              enqueueOptimizerCriticalAlert({
                tickId,
                projectId: proj.id,
                campaignId: camp.id,
                platform: camp.platform,
                action: cand.decisionType,
                reason: cand.reason,
                execution_detail: exec.detail.slice(0, 8000),
                metrics: {
                  phase: "decision_execution_failed",
                  rule_code: cand.ruleCode,
                  ...buildOptimizerAlertMetrics(bundle, lookbackHours),
                },
              });
            }
          }
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    enqueueOptimizerCriticalAlert({
      tickId,
      reason: msg,
      execution_detail: e instanceof Error ? e.stack?.slice(0, 8000) : undefined,
      metrics: { phase: "tick_fatal" },
    });
    optimizerLog("error", "tick_fatal", {
      tickId,
      error: msg,
      stack: e instanceof Error ? e.stack?.slice(0, 1200) : undefined,
    });
    throw e;
  } finally {
    result.durationMs = Date.now() - t0;
    optimizerLog("info", "tick_complete", { ...result });
  }

  return result;
}

function buildOptimizerAlertMetrics(bundle: CampaignMetricsBundle, lookbackHours: number): Record<string, unknown> {
  return {
    lookback_hours: lookbackHours,
    spend_usd_platform: bundle.spendUsdPlatform,
    tracking_clicks: bundle.tracking.clicks,
    tracking_impressions: bundle.tracking.impressions,
    tracking_revenue_usd: bundle.tracking.revenueUsd,
    approved_conversions: bundle.tracking.approvedConversions,
    conversion_events: bundle.tracking.conversionEvents,
  };
}

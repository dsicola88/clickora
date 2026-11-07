/**
 * Ciclo principal — scheduler → optimizer.service → metrics → rules → actions.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../paidPrisma";
import { executeOptimizerDecision, readCampaignDailyBudgetUsd } from "./actions.service";
import {
  enqueueBudgetReallocatedAlert,
  enqueueBudgetScaledAlert,
  enqueueCampaignPausedAlert,
  enqueueCreativeSwapFlaggedAlert,
  enqueueOptimizerCriticalAlert,
} from "./alerts.service";
import {
  optimizerDryRun,
  optimizerEnabled,
  optimizerLookbackHours,
  optimizerRulesPhase,
  resolveEffectiveOptimizerPauseMinClicks,
  resolveEffectiveOptimizerPauseSpendUsd,
} from "./config";
import { hasRecentSuccessfulDecision, shouldApplyIdempotencyCheck } from "./idempotency";
import { optimizerLog } from "./logger";
import { collectCampaignMetricsBundle, type CampaignMetricsBundle } from "./metrics.service";
import { proposeBudgetReallocations } from "./reallocate.engine";
import { evaluateOptimizerRules, type OptimizerDecisionCandidate } from "./rules.engine";

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
        select: {
          optimizerPauseSpendUsd: true,
          optimizerPauseMinClicks: true,
          maxMonthlySpendMicros: true,
        },
      });
      const projectPauseUsd =
        grRow?.optimizerPauseSpendUsd != null ? Number(grRow.optimizerPauseSpendUsd) : null;
      const projectPauseClicks = grRow?.optimizerPauseMinClicks ?? null;
      const accountMonthlyCapUsd =
        grRow?.maxMonthlySpendMicros != null
          ? Number(grRow.maxMonthlySpendMicros) / 1_000_000
          : null;

      /** Fase 1: métricas de todas as campanhas (precisa do gasto do projecto para o cap). */
      type CampBundle = {
        camp: (typeof campaigns)[number];
        bundle: CampaignMetricsBundle;
        effPauseUsd: number;
        effPauseClicks: number;
      };
      const prepared: CampBundle[] = [];

      for (const camp of campaigns) {
        result.campaignsEvaluated += 1;

        const effPauseUsd = resolveEffectiveOptimizerPauseSpendUsd(
          camp.optimizerPauseSpendUsd != null ? Number(camp.optimizerPauseSpendUsd) : null,
          projectPauseUsd,
        );
        const effPauseClicks = resolveEffectiveOptimizerPauseMinClicks(
          camp.optimizerPauseMinClicks ?? null,
          projectPauseClicks,
        );

        try {
          const bundle = await collectCampaignMetricsBundle({
            projectId: proj.id,
            userId: proj.userId,
            campaignId: camp.id,
            platform: camp.platform,
            externalCampaignId: camp.externalCampaignId,
            since,
            to,
            trace: { tickId },
          });
          prepared.push({ camp, bundle, effPauseUsd, effPauseClicks });
        } catch (e) {
          result.campaignsFailed += 1;
          optimizerLog("error", "campaign_metrics_failed", {
            tickId,
            projectId: proj.id,
            campaignId: camp.id,
            platform: camp.platform,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      const projectSpendUsdKnown = prepared.reduce((s, row) => {
        const v = row.bundle.spendUsdPlatform;
        return s + (v != null && Number.isFinite(v) ? v : 0);
      }, 0);

      if (accountMonthlyCapUsd != null && projectSpendUsdKnown >= accountMonthlyCapUsd) {
        optimizerLog("info", "account_monthly_cap_hit", {
          tickId,
          projectId: proj.id,
          accountMonthlyCapUsd,
          projectSpendUsdKnown,
        });
      }

      /** Fase 2: regras por campanha. */
      type CampEval = CampBundle & { candidates: OptimizerDecisionCandidate[] };
      const evaluated: CampEval[] = [];
      for (const row of prepared) {
        const candidates = evaluateOptimizerRules({
          platform: row.camp.platform,
          tracking: row.bundle.tracking,
          spendUsdPlatform: row.bundle.spendUsdPlatform,
          effectivePauseSpendUsd: row.effPauseUsd,
          effectivePauseMinClicks: row.effPauseClicks,
          accountMonthlyCapUsd,
          projectSpendUsdKnown,
        });
        evaluated.push({ ...row, candidates });
      }

      /** Fase 2b: redistribuição entre campanhas (mesma rede; neutra em gasto). */
      const receiversWithRealloc = new Set<string>();
      if (optimizerRulesPhase() === "all") {
        const reallocSnaps = [];
        for (const row of evaluated) {
          const dailyBudgetUsd = await readCampaignDailyBudgetUsd(row.camp);
          if (dailyBudgetUsd == null) continue;
          reallocSnaps.push({
            campaignId: row.camp.id,
            platform: row.camp.platform,
            spendUsd: row.bundle.spendUsdPlatform,
            revenueUsd: row.bundle.tracking.revenueUsd,
            dailyBudgetUsd,
            wouldPause: row.candidates.some((c) => c.decisionType === "pause_campaign"),
          });
        }
        const reallocs = proposeBudgetReallocations(reallocSnaps);
        for (const prop of reallocs) {
          const receiverRow = evaluated.find((e) => e.camp.id === prop.receiverCampaignId);
          if (!receiverRow) continue;

          const cand: OptimizerDecisionCandidate = {
            ruleCode: prop.ruleCode,
            decisionType: prop.decisionType,
            reason: prop.reason,
            inputSnapshot: prop.inputSnapshot,
          };

          const applied = await applyOptimizerCandidate({
            result,
            tickId,
            dryRun,
            lookbackHours,
            projectId: proj.id,
            camp: receiverRow.camp,
            bundle: receiverRow.bundle,
            cand,
          });
          if (applied) receiversWithRealloc.add(prop.receiverCampaignId);
        }
      }

      /** Fase 3: acções por campanha (escala omitida se já houve redistribuição para o vencedor). */
      for (const { camp, bundle, candidates } of evaluated) {
        const filtered = receiversWithRealloc.has(camp.id)
          ? candidates.filter((c) => c.decisionType !== "scale_budget")
          : candidates;
        if (filtered.length === 0) continue;

        for (const cand of filtered) {
          await applyOptimizerCandidate({
            result,
            tickId,
            dryRun,
            lookbackHours,
            projectId: proj.id,
            camp,
            bundle,
            cand,
          });
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

/** Grava + executa uma decisão; devolve true se executou com sucesso (incl. dry-run ok). */
async function applyOptimizerCandidate(args: {
  result: OptimizerTickResult;
  tickId: string;
  dryRun: boolean;
  lookbackHours: number;
  projectId: string;
  camp: Awaited<ReturnType<typeof prisma.paidAdsCampaign.findMany>>[number];
  bundle: CampaignMetricsBundle;
  cand: OptimizerDecisionCandidate;
}): Promise<boolean> {
  const { result, tickId, dryRun, lookbackHours, projectId, camp, bundle, cand } = args;

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
      projectId,
      campaignId: camp.id,
      ruleCode: cand.ruleCode,
      decisionType: cand.decisionType,
    });
    return false;
  }

  const row = await prisma.paidAdsOptimizerDecision.create({
    data: {
      projectId,
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
    projectId,
    campaignId: camp.id,
    platform: camp.platform,
    ruleCode: cand.ruleCode,
    decisionType: cand.decisionType,
    dryRun,
  });

  const exec = await executeOptimizerDecision({
    projectId,
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
      projectId,
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
          projectId,
          campaignId: camp.id,
          platform: camp.platform,
          reason: cand.reason,
          metrics: metricsPayload,
        });
      } else if (cand.decisionType === "scale_budget") {
        enqueueBudgetScaledAlert({
          tickId,
          projectId,
          campaignId: camp.id,
          platform: camp.platform,
          reason: cand.reason,
          metrics: metricsPayload,
        });
      } else if (cand.decisionType === "reallocate_budget") {
        enqueueBudgetReallocatedAlert({
          tickId,
          projectId,
          campaignId: camp.id,
          platform: camp.platform,
          reason: cand.reason,
          metrics: {
            ...metricsPayload,
            donor_campaign_id: cand.inputSnapshot.donorCampaignId,
            transfer_usd: cand.inputSnapshot.transferUsd,
          },
        });
      } else if (cand.decisionType === "flag_creative_swap") {
        enqueueCreativeSwapFlaggedAlert({
          tickId,
          projectId,
          campaignId: camp.id,
          platform: camp.platform,
          reason: cand.reason,
          metrics: metricsPayload,
        });
      }
    }
    return true;
  }

  result.decisionsFailed += 1;
  optimizerLog("warn", "decision_failed", {
    tickId,
    projectId,
    campaignId: camp.id,
    ruleCode: cand.ruleCode,
    decisionType: cand.decisionType,
    detailPreview: exec.detail.slice(0, 400),
  });
  if (
    !dryRun &&
    (cand.decisionType === "pause_campaign" ||
      cand.decisionType === "scale_budget" ||
      cand.decisionType === "reallocate_budget")
  ) {
    enqueueOptimizerCriticalAlert({
      tickId,
      projectId,
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
  return false;
}

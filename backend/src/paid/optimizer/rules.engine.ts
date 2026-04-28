/**
 * Motor de regras V0 — fluxo: metrics.service → rules.engine → actions.service
 */
import type { PaidAdsPlatform } from "@prisma/client";

import {
  ctrLowThreshold,
  optimizerRulesPhase,
  pauseSpendUsdThreshold,
  scaleBudgetFraction,
  scaleRoasThreshold,
} from "./config";
import { ctrFromTracking, type TrackingCampaignMetrics } from "./tracking-metrics";

export type OptimizerDecisionCandidate = {
  ruleCode: string;
  decisionType: "pause_campaign" | "scale_budget" | "flag_creative_swap";
  reason: string;
  inputSnapshot: Record<string, unknown>;
};

export type RuleEvaluationInput = {
  platform: PaidAdsPlatform;
  tracking: TrackingCampaignMetrics;
  /** USD — só preenchido quando a API da rede devolve gasto (Google/Meta). */
  spendUsdPlatform: number | null;
};

/** Prioridade: pausa antes de escalar; flags são não-destrutivos. */
export function evaluateOptimizerRules(input: RuleEvaluationInput): OptimizerDecisionCandidate[] {
  const { tracking, spendUsdPlatform, platform } = input;

  const conversionsZero =
    tracking.approvedConversions === 0 &&
    tracking.conversionEvents === 0;

  const ctr = ctrFromTracking(tracking);

  const candidates: OptimizerDecisionCandidate[] = [];

  const spendUsd = spendUsdPlatform ?? null;
  const minSpend = pauseSpendUsdThreshold();

  if (
    conversionsZero &&
    spendUsd !== null &&
    spendUsd >= minSpend &&
    tracking.clicks >= 5
  ) {
    candidates.push({
      ruleCode: "pause_zero_conv_min_spend",
      decisionType: "pause_campaign",
      reason: `Gasto ≥ $${minSpend.toFixed(2)} (${platform}) sem conversões na janela; CTR/cliques presentes.`,
      inputSnapshot: {
        spendUsd,
        clicks: tracking.clicks,
        impressions: tracking.impressions,
        approvedConversions: tracking.approvedConversions,
      },
    });
  }

  if (
    ctr !== null &&
    ctr < ctrLowThreshold() &&
    tracking.impressions >= 100 &&
    tracking.clicks >= 1
  ) {
    candidates.push({
      ruleCode: "ctr_below_threshold",
      decisionType: "flag_creative_swap",
      reason: `CTR ${(ctr * 100).toFixed(2)}% < ${(ctrLowThreshold() * 100).toFixed(2)}% com impressões suficientes.`,
      inputSnapshot: {
        ctr,
        impressions: tracking.impressions,
        clicks: tracking.clicks,
      },
    });
  }

  const hasPause = candidates.some((c) => c.decisionType === "pause_campaign");
  if (!hasPause && spendUsd !== null && spendUsd >= 1 && tracking.revenueUsd > 0) {
    const revenue = tracking.revenueUsd;
    const roas = revenue / Math.max(spendUsd, 1e-6);
    const minRoas = scaleRoasThreshold();
    if (roas >= minRoas) {
      candidates.push({
        ruleCode: "scale_budget_high_roas",
        decisionType: "scale_budget",
        reason: `ROAS ${roas.toFixed(2)} ≥ ${minRoas} com receita $${revenue.toFixed(2)} e gasto $${spendUsd.toFixed(2)}.`,
        inputSnapshot: {
          roas,
          revenueUsd: revenue,
          spendUsd,
          scaleFraction: scaleBudgetFraction(),
        },
      });
    }
  }

  const deduped = dedupeByDecisionType(candidates);
  let out = deduped.some((c) => c.decisionType === "pause_campaign")
    ? deduped.filter((c) => c.decisionType !== "scale_budget")
    : deduped;

  if (optimizerRulesPhase() === "pause_only") {
    out = out.filter((c) => c.decisionType === "pause_campaign");
  }

  return out;
}

function dedupeByDecisionType(candidates: OptimizerDecisionCandidate[]): OptimizerDecisionCandidate[] {
  const seen = new Set<string>();
  const out: OptimizerDecisionCandidate[] = [];
  const order = ["pause_campaign", "scale_budget", "flag_creative_swap"] as const;
  const sorted = [...candidates].sort(
    (a, b) =>
      order.indexOf(a.decisionType as (typeof order)[number]) -
      order.indexOf(b.decisionType as (typeof order)[number]),
  );
  for (const c of sorted) {
    if (seen.has(c.decisionType)) continue;
    seen.add(c.decisionType);
    out.push(c);
  }
  return out;
}

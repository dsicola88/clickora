/**
 * Antes de aplicar na rede, garante que o estado actual da campanha não viola
 * limites rígidos do projeto (orçamento máximo, países, keywords bloqueadas).
 */
import type { PaidAdsChangeRequestType, PaidAdsGuardrails } from "@prisma/client";

import { blockingViolationMessagesForApply, type GuardrailLimits } from "./guardrails-eval";
import { prisma } from "./paidPrisma";

function rowToLimits(g: PaidAdsGuardrails): GuardrailLimits {
  return {
    max_daily_budget_micros: Number(g.maxDailyBudgetMicros),
    max_monthly_spend_micros: Number(g.maxMonthlySpendMicros),
    max_cpc_micros: g.maxCpcMicros != null ? Number(g.maxCpcMicros) : null,
    allowed_countries: g.allowedCountries,
    blocked_keywords: g.blockedKeywords,
    require_approval_above_micros:
      g.requireApprovalAboveMicros != null ? Number(g.requireApprovalAboveMicros) : null,
  };
}

function parseGeoTargets(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x).trim()).filter(Boolean);
}

export async function workspaceAllowsApplyBeforeRemote(
  projectId: string,
  type: PaidAdsChangeRequestType,
  payload: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gr = await prisma.paidAdsGuardrails.findUnique({ where: { projectId } });
  if (!gr) return { ok: true };

  const limits = rowToLimits(gr);
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const campaignId = typeof p.campaign_id === "string" ? p.campaign_id : undefined;

  switch (type) {
    case "create_campaign":
    case "meta_create_campaign":
    case "tiktok_create_campaign": {
      if (!campaignId) return { ok: true };
      const campaign = await prisma.paidAdsCampaign.findFirst({
        where: { id: campaignId, projectId },
        include: { adGroups: { include: { keywords: true } } },
      });
      if (!campaign) return { ok: true };

      const geoTargets = parseGeoTargets(campaign.geoTargets);
      const keywordTexts = campaign.adGroups.flatMap((ag) => ag.keywords.map((k) => k.text));
      const msgs = blockingViolationMessagesForApply(limits, {
        dailyBudgetMicros: Number(campaign.dailyBudgetMicros ?? 0),
        geoTargets,
        keywordTexts,
      });
      if (msgs.length === 0) return { ok: true };
      return {
        ok: false,
        message: `Não é possível aplicar na rede até corrigir estes pontos: ${msgs.join(" ")} Depois volte aqui e use novamente «Aplicar na rede».`,
      };
    }
    default:
      return { ok: true };
  }
}

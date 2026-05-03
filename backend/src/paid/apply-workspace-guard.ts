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

function getStr(p: Record<string, unknown>, k: string): string | undefined {
  const v = p[k];
  return typeof v === "string" ? v : undefined;
}

function getNum(p: Record<string, unknown>, k: string): number | undefined {
  const v = p[k];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return undefined;
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
    case "update_budget": {
      const cid = getStr(p, "campaign_id");
      const m = getNum(p, "daily_budget_micros");
      if (!cid || m == null) return { ok: true };
      const campaign = await prisma.paidAdsCampaign.findFirst({
        where: { id: cid, projectId },
        include: { adGroups: { include: { keywords: true } } },
      });
      if (!campaign) return { ok: true };
      const geoTargets = parseGeoTargets(campaign.geoTargets);
      const keywordTexts = campaign.adGroups.flatMap((ag) => ag.keywords.map((k) => k.text));
      const msgs = blockingViolationMessagesForApply(limits, {
        dailyBudgetMicros: m,
        geoTargets,
        keywordTexts,
      });
      if (msgs.length === 0) return { ok: true };
      return {
        ok: false,
        message: `Não é possível aplicar na rede até corrigir estes pontos: ${msgs.join(" ")} Depois volte aqui e use novamente «Aplicar na rede».`,
      };
    }
    case "add_keywords": {
      const agId = getStr(p, "ad_group_id");
      if (!agId) return { ok: true };
      const ag = await prisma.paidAdsAdGroup.findFirst({
        where: { id: agId, campaign: { projectId } },
        include: { campaign: { include: { adGroups: { include: { keywords: true } } } } },
      });
      if (!ag) return { ok: true };
      const kws = p.keywords;
      const incoming =
        Array.isArray(kws)
          ? kws.map((k) => String((k as Record<string, unknown>).text ?? "").trim()).filter(Boolean)
          : [];
      const geoTargets = parseGeoTargets(ag.campaign.geoTargets);
      const existing = ag.campaign.adGroups.flatMap((g) => g.keywords.map((k) => k.text));
      const msgs = blockingViolationMessagesForApply(limits, {
        dailyBudgetMicros: Number(ag.campaign.dailyBudgetMicros ?? 0),
        geoTargets,
        keywordTexts: [...existing, ...incoming],
      });
      if (msgs.length === 0) return { ok: true };
      return {
        ok: false,
        message: `Não é possível aplicar na rede até corrigir estes pontos: ${msgs.join(" ")} Depois volte aqui e use novamente «Aplicar na rede».`,
      };
    }
    case "update_ad_group_cpc": {
      const mic = getNum(p, "cpc_bid_micros");
      if (mic == null || limits.max_cpc_micros == null) return { ok: true };
      if (mic > Number(limits.max_cpc_micros)) {
        return {
          ok: false,
          message: `O CPC proposto (${(mic / 1_000_000).toFixed(2)} USD) excede o teto CPC dos guardrails (${(Number(limits.max_cpc_micros) / 1_000_000).toFixed(2)} USD). Ajuste o valor ou os guardrails em «Visão geral».`,
        };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

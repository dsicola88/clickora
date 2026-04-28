/**
 * Execução das decisões — actions.service → integrations (Google / Meta / TikTok).
 */
import type { PaidAdsCampaign } from "@prisma/client";

import { prisma } from "../paidPrisma";
import * as googleAds from "./integrations/googleAds.integration";
import * as metaAds from "./integrations/metaAds.integration";
import * as tiktokAds from "./integrations/tiktokAds.integration";
import { scaleBudgetFraction } from "./config";
import type { OptimizerDecisionCandidate } from "./rules.engine";
import { retryAdsMutation } from "./retry";

async function guardrailMaxDailyMicros(projectId: string): Promise<bigint> {
  const g = await prisma.paidAdsGuardrails.findUnique({ where: { projectId } });
  return g?.maxDailyBudgetMicros ?? BigInt(50_000_000);
}

export async function executeOptimizerDecision(args: {
  projectId: string;
  campaign: PaidAdsCampaign;
  candidate: OptimizerDecisionCandidate;
  dryRun: boolean;
  /** Correlaciona logs / retries com um ciclo (`tickId`). */
  trace?: Record<string, unknown>;
}): Promise<{ ok: boolean; detail: string }> {
  const { projectId, campaign, candidate, dryRun, trace = {} } = args;

  if (dryRun) {
    return { ok: true, detail: "[dry-run] não executado na rede." };
  }

  try {
    if (candidate.decisionType === "pause_campaign") {
      return await pauseCampaign(projectId, campaign, trace);
    }
    if (candidate.decisionType === "scale_budget") {
      return await scaleBudget(projectId, campaign, trace);
    }
    if (candidate.decisionType === "flag_creative_swap") {
      return await flagCreativeSwap(campaign, candidate);
    }
    return { ok: false, detail: `Tipo desconhecido: ${candidate.decisionType}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg };
  }
}

async function pauseCampaign(
  projectId: string,
  campaign: PaidAdsCampaign,
  trace: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  if (campaign.status === "paused" || campaign.status === "archived") {
    return { ok: true, detail: "Campanha já pausada/arquivada." };
  }

  const t = { ...trace, projectId, campaignId: campaign.id, platform: campaign.platform, action: "pause_campaign" };

  if (campaign.platform === "google_ads") {
    const r = await retryAdsMutation("google_pause_campaign", () => googleAds.pauseCampaign(projectId, campaign.id), t);
    return r.ok ? { ok: true, detail: "Google: campanha pausada." } : { ok: false, detail: r.error };
  }

  if (campaign.platform === "meta_ads") {
    const r = await retryAdsMutation("meta_pause_campaign", () => metaAds.pauseCampaign(projectId, campaign.id), t);
    return r.ok ? { ok: true, detail: "Meta: campanha pausada." } : { ok: false, detail: r.error };
  }

  if (campaign.platform === "tiktok_ads") {
    const r = await retryAdsMutation("tiktok_pause_campaign", () => tiktokAds.pauseCampaign(projectId, campaign.id), t);
    return r.ok ? { ok: true, detail: "TikTok: campanha pausada." } : { ok: false, detail: r.error };
  }

  return { ok: false, detail: `Plataforma não suportada: ${campaign.platform}` };
}

async function scaleBudget(
  projectId: string,
  campaign: PaidAdsCampaign,
  trace: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  const maxMicros = await guardrailMaxDailyMicros(projectId);
  const frac = scaleBudgetFraction();
  const t = { ...trace, projectId, campaignId: campaign.id, platform: campaign.platform, action: "scale_budget" };

  if (campaign.platform === "google_ads") {
    const cur = campaign.dailyBudgetMicros ?? BigInt(5_000_000);
    const scaled = BigInt(Math.round(Number(cur) * (1 + frac)));
    const capped = scaled > maxMicros ? maxMicros : scaled;
    const micros = Number(capped);
    const r = await retryAdsMutation(
      "google_update_budget",
      () => googleAds.updateCampaignDailyBudgetMicros(projectId, campaign.id, micros),
      t,
    );
    return r.ok
      ? { ok: true, detail: `Google: orçamento diário → ${Number(capped) / 1_000_000} USD (micros ${capped}).` }
      : { ok: false, detail: r.error };
  }

  if (campaign.platform === "meta_ads") {
    const ag = await prisma.paidAdsMetaAdset.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: "asc" },
    });
    if (!ag?.id) return { ok: false, detail: "Meta: sem ad set local para escalar." };
    const curCents = Number(ag.dailyBudgetCents ?? 50000n);
    const scaled = Math.max(100, Math.round(curCents * (1 + frac)));
    const maxCents = Number(maxMicros) / 10000;
    const capped = Math.min(scaled, Math.max(100, Math.round(maxCents)));
    const r = await retryAdsMutation(
      "meta_adset_budget",
      () => metaAds.updateAdsetDailyBudgetCents(projectId, ag.id, capped),
      { ...t, metaAdsetId: ag.id },
    );
    return r.ok ? { ok: true, detail: `Meta: ad set orçamento → ${capped} cents/dia.` } : { ok: false, detail: r.error };
  }

  if (campaign.platform === "tiktok_ads") {
    const cur = campaign.dailyBudgetMicros ?? BigInt(5_000_000);
    const scaled = BigInt(Math.round(Number(cur) * (1 + frac)));
    const capped = scaled > maxMicros ? maxMicros : scaled;
    const micros = Number(capped);
    const r = await retryAdsMutation(
      "tiktok_update_budget",
      () => tiktokAds.updateCampaignDailyBudgetMicros(projectId, campaign.id, micros),
      t,
    );
    return r.ok ? { ok: true, detail: `TikTok: orçamento escalado.` } : { ok: false, detail: r.error };
  }

  return { ok: false, detail: `Plataforma não suportada: ${campaign.platform}` };
}

async function flagCreativeSwap(
  campaign: PaidAdsCampaign,
  candidate: OptimizerDecisionCandidate,
): Promise<{ ok: boolean; detail: string }> {
  const prev = (campaign.optimizerFlags ?? {}) as Record<string, unknown>;
  const next = {
    ...prev,
    creative_swap_recommended_at: new Date().toISOString(),
    creative_swap_rule: candidate.ruleCode,
    creative_swap_reason: candidate.reason,
    creative_swap_inputs: candidate.inputSnapshot,
  };
  await prisma.paidAdsCampaign.update({
    where: { id: campaign.id },
    data: { optimizerFlags: next as object },
  });
  return { ok: true, detail: "Flag creative_swap gravada em optimizer_flags." };
}

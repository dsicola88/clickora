/**
 * Loop Copilot de criativo (MVP A/B):
 * flag CTR (`optimizer_flags.creative_swap_*`) → enfileira publicação do próximo rascunho
 * (Meta creative / Google RSA) → limpa a flag.
 * Ranking por métricas de rede (Meta insights level=ad / Google ad_group_ad) para
 * sugerir vencedor vs perdedor — sem inventar copy nem funil.
 */
import type { PaidAdsChangeRequestType, PaidAdsPlatform } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { applyChangeRequestRemote } from "./change-request-apply";
import { workspaceAllowsApplyBeforeRemote } from "./apply-workspace-guard";
import {
  rankCreativeVariants,
  type CreativeRankingResult,
  type CreativeVariantMetrics,
} from "./creativeRanking";
import { fetchGoogleAdGroupAdMetrics } from "./optimizer/google-metrics";
import { fetchMetaAdInsights } from "./optimizer/meta-metrics";
import { prisma } from "./paidPrisma";
import { isOAuthPendingToken, loadPaidToken } from "./tokenSecrets";

export type CreativeSwapPreview = {
  campaign_id: string;
  platform: PaidAdsPlatform;
  has_flag: boolean;
  flag_reason: string | null;
  next_action:
    | {
        type: "meta_publish_creative";
        creative_id: string;
        label: string;
      }
    | {
        type: "publish_rsa";
        paid_ads_rsa_id: string;
        label: string;
      }
    | null;
  detail: string;
  /** Ranking por métricas da rede (últimos ~7d); null se plataforma sem suporte. */
  ranking: CreativeRankingResult | null;
  ranking_source: "meta_insights" | "google_ads" | "unavailable" | null;
  ranking_error: string | null;
};

function asFlags(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function jsonStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

export async function previewCreativeSwap(args: {
  projectId: string;
  campaignId: string;
}): Promise<CreativeSwapPreview | { error: string; status: number }> {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: args.campaignId, projectId: args.projectId },
    select: {
      id: true,
      platform: true,
      name: true,
      optimizerFlags: true,
      externalCampaignId: true,
    },
  });
  if (!camp) return { error: "Campanha não encontrada.", status: 404 };

  const flags = asFlags(camp.optimizerFlags);
  const hasFlag =
    typeof flags.creative_swap_recommended_at === "string" &&
    flags.creative_swap_recommended_at.length > 0;
  const flagReason =
    typeof flags.creative_swap_reason === "string" ? flags.creative_swap_reason : null;

  const next = await resolveNextCreativeAction(camp.id, camp.platform);
  const ranked = await rankPublishedCreatives({
    projectId: args.projectId,
    campaignId: camp.id,
    platform: camp.platform,
    externalCampaignId: camp.externalCampaignId,
  });

  return {
    campaign_id: camp.id,
    platform: camp.platform,
    has_flag: hasFlag,
    flag_reason: flagReason,
    next_action: next.action,
    detail: next.detail,
    ranking: ranked.ranking,
    ranking_source: ranked.source,
    ranking_error: ranked.error,
  };
}

/** Agrega métricas de rede por anúncio publicado e devolve ranking. */
export async function rankPublishedCreatives(args: {
  projectId: string;
  campaignId: string;
  platform: PaidAdsPlatform;
  externalCampaignId: string | null;
}): Promise<{
  ranking: CreativeRankingResult | null;
  source: CreativeSwapPreview["ranking_source"];
  error: string | null;
}> {
  if (args.platform === "meta_ads") {
    return rankMetaCreatives(args);
  }
  if (args.platform === "google_ads") {
    return rankGoogleRsas(args);
  }
  return {
    ranking: null,
    source: "unavailable",
    error: "Ranking por anúncio ainda não disponível nesta rede.",
  };
}

async function rankMetaCreatives(args: {
  projectId: string;
  campaignId: string;
  externalCampaignId: string | null;
}): Promise<{
  ranking: CreativeRankingResult | null;
  source: CreativeSwapPreview["ranking_source"];
  error: string | null;
}> {
  const ads = await prisma.paidAdsMetaAd.findMany({
    where: {
      adset: { campaignId: args.campaignId },
      externalAdId: { not: null },
    },
    select: {
      id: true,
      name: true,
      externalAdId: true,
      creative: { select: { headline: true, primaryText: true } },
    },
  });

  const conn = await prisma.paidAdsMetaConnection.findUnique({
    where: { projectId: args.projectId },
  });
  if (
    !conn ||
    conn.status !== "connected" ||
    !conn.tokenRef ||
    isOAuthPendingToken(conn.tokenRef)
  ) {
    return {
      ranking: rankCreativeVariants([]),
      source: "meta_insights",
      error: "Meta não ligado — sem insights por anúncio.",
    };
  }

  const token = loadPaidToken(conn.tokenRef);
  if (!token) {
    return {
      ranking: rankCreativeVariants([]),
      source: "meta_insights",
      error: "Token Meta indisponível.",
    };
  }

  const insight = await fetchMetaAdInsights({
    accessToken: token,
    externalCampaignId: args.externalCampaignId,
  });
  if (!insight.ok) {
    return {
      ranking: rankCreativeVariants([]),
      source: "meta_insights",
      error: insight.error,
    };
  }

  const byExt = new Map(insight.rows.map((r) => [r.ad_id.replace(/\D/g, ""), r]));
  const variants: CreativeVariantMetrics[] = ads.map((ad) => {
    const ext = String(ad.externalAdId ?? "").replace(/\D/g, "");
    const m = byExt.get(ext);
    const label =
      (ad.creative.headline || ad.creative.primaryText || ad.name || "Anúncio").slice(0, 80);
    const impressions = m?.impressions ?? 0;
    const clicks = m?.clicks ?? 0;
    return {
      id: ad.id,
      label,
      external_id: ad.externalAdId,
      impressions,
      clicks,
      spend_usd: m?.spend_usd ?? 0,
      conversions: m?.conversions ?? 0,
      ctr: impressions > 0 ? clicks / impressions : null,
    };
  });

  // Anúncios só na rede (ainda sem espelho local) — incluir no ranking com id externo.
  for (const row of insight.rows) {
    const digits = row.ad_id.replace(/\D/g, "");
    if (ads.some((a) => String(a.externalAdId ?? "").replace(/\D/g, "") === digits)) continue;
    variants.push({
      id: `meta:${row.ad_id}`,
      label: row.ad_name.slice(0, 80),
      external_id: row.ad_id,
      impressions: row.impressions,
      clicks: row.clicks,
      spend_usd: row.spend_usd,
      conversions: row.conversions,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    });
  }

  return {
    ranking: rankCreativeVariants(variants),
    source: "meta_insights",
    error: null,
  };
}

async function rankGoogleRsas(args: {
  projectId: string;
  campaignId: string;
  externalCampaignId: string | null;
}): Promise<{
  ranking: CreativeRankingResult | null;
  source: CreativeSwapPreview["ranking_source"];
  error: string | null;
}> {
  const rsas = await prisma.paidAdsRsa.findMany({
    where: {
      adGroup: { campaignId: args.campaignId },
      externalAdId: { not: null },
    },
    select: {
      id: true,
      headlines: true,
      externalAdId: true,
    },
  });

  const metrics = await fetchGoogleAdGroupAdMetrics({
    projectId: args.projectId,
    externalCampaignId: args.externalCampaignId,
  });
  if (!metrics.ok) {
    return {
      ranking: rankCreativeVariants([]),
      source: "google_ads",
      error: metrics.error,
    };
  }

  const byExt = new Map(metrics.rows.map((r) => [r.ad_id.replace(/\D/g, ""), r]));
  const variants: CreativeVariantMetrics[] = rsas.map((r) => {
    const ext = String(r.externalAdId ?? "").replace(/\D/g, "");
    const m = byExt.get(ext);
    const hl = jsonStringList(r.headlines)[0] || "RSA";
    const impressions = m?.impressions ?? 0;
    const clicks = m?.clicks ?? 0;
    return {
      id: r.id,
      label: hl.slice(0, 80),
      external_id: r.externalAdId,
      impressions,
      clicks,
      spend_usd: m ? m.cost_micros / 1_000_000 : 0,
      conversions: m?.conversions ?? 0,
      ctr: impressions > 0 ? clicks / impressions : null,
    };
  });

  for (const row of metrics.rows) {
    const digits = row.ad_id.replace(/\D/g, "");
    if (rsas.some((r) => String(r.externalAdId ?? "").replace(/\D/g, "") === digits)) continue;
    variants.push({
      id: `google:${row.ad_id}`,
      label: `Ad ${row.ad_id}`,
      external_id: row.ad_id,
      impressions: row.impressions,
      clicks: row.clicks,
      spend_usd: row.cost_micros / 1_000_000,
      conversions: row.conversions,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : null,
    });
  }

  return {
    ranking: rankCreativeVariants(variants),
    source: "google_ads",
    error: null,
  };
}

async function resolveNextCreativeAction(
  campaignId: string,
  platform: PaidAdsPlatform,
): Promise<{
  action: CreativeSwapPreview["next_action"];
  detail: string;
}> {
  if (platform === "meta_ads") {
    const creatives = await prisma.paidAdsMetaCreative.findMany({
      where: { adset: { campaignId } },
      include: {
        ads: { select: { externalAdId: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const draft = creatives.find(
      (c) =>
        (c.status === "draft" || c.externalId == null) &&
        !c.ads.some((a) => a.externalAdId != null && String(a.externalAdId).trim() !== ""),
    );
    if (!draft) {
      return {
        action: null,
        detail:
          "Sem criativo Meta em rascunho por publicar. Gere outra variante no assistente Meta ou marque como tratado.",
      };
    }
    const label = (draft.headline || draft.primaryText || "Criativo").slice(0, 80);
    return {
      action: {
        type: "meta_publish_creative",
        creative_id: draft.id,
        label,
      },
      detail: `Próximo rascunho Meta: «${label}».`,
    };
  }

  if (platform === "google_ads") {
    const rsas = await prisma.paidAdsRsa.findMany({
      where: { adGroup: { campaignId } },
      orderBy: { createdAt: "asc" },
    });
    const draft = rsas.find(
      (r) =>
        r.externalAdId == null &&
        (r.status === "draft" || r.status === "pending_publish") &&
        jsonStringList(r.headlines).length >= 3 &&
        jsonStringList(r.descriptions).length >= 2,
    );
    if (!draft) {
      return {
        action: null,
        detail:
          "Sem RSA Google em rascunho por publicar. Crie outra variante no estúdio Google ou marque como tratado.",
      };
    }
    const hl = jsonStringList(draft.headlines)[0] || "RSA";
    return {
      action: {
        type: "publish_rsa",
        paid_ads_rsa_id: draft.id,
        label: hl.slice(0, 80),
      },
      detail: `Próximo RSA em rascunho: «${hl.slice(0, 80)}».`,
    };
  }

  return {
    action: null,
    detail:
      "TikTok: o motor assinala CTR baixo, mas a publicação de variante de vídeo ainda não está no loop Copilot — marque como tratado ou ajuste o criativo na TikTok Ads.",
  };
}

export async function clearCreativeSwapFlag(args: {
  projectId: string;
  campaignId: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: args.campaignId, projectId: args.projectId },
    select: { id: true, optimizerFlags: true },
  });
  if (!camp) return { error: "Campanha não encontrada.", status: 404 };

  const prev = asFlags(camp.optimizerFlags);
  const next: Record<string, unknown> = { ...prev };
  delete next.creative_swap_recommended_at;
  delete next.creative_swap_rule;
  delete next.creative_swap_reason;
  delete next.creative_swap_inputs;
  next.creative_swap_cleared_at = new Date().toISOString();

  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: { optimizerFlags: next as Prisma.InputJsonValue },
  });
  return { ok: true };
}

/**
 * Enfileira publicação do próximo rascunho (Copilot) e limpa a flag.
 * Em Autopilot tenta aplicar na rede de imediato (mesmo fluxo do estúdio).
 */
export async function applyCreativeSwap(args: {
  projectId: string;
  campaignId: string;
  requestedById: string;
}): Promise<
  | {
      ok: true;
      change_request_id: string;
      change_request_status: string;
      next_action: NonNullable<CreativeSwapPreview["next_action"]>;
      flag_cleared: boolean;
      apply_error?: string;
    }
  | { error: string; status: number }
> {
  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: args.campaignId, projectId: args.projectId },
    select: { id: true, platform: true, optimizerFlags: true },
  });
  if (!camp) return { error: "Campanha não encontrada.", status: 404 };

  const resolved = await resolveNextCreativeAction(camp.id, camp.platform);
  if (!resolved.action) {
    return { error: resolved.detail, status: 400 };
  }

  const project = await prisma.paidAdsProject.findFirst({
    where: { id: args.projectId },
    select: { userId: true, paidMode: true },
  });
  if (!project) return { error: "Projecto não encontrado.", status: 404 };

  const type = resolved.action.type as PaidAdsChangeRequestType;
  const payload: Record<string, unknown> =
    resolved.action.type === "meta_publish_creative"
      ? {
          creative_id: resolved.action.creative_id,
          campaign_id: camp.id,
          source: "creative_swap_copilot",
        }
      : {
          paid_ads_rsa_id: resolved.action.paid_ads_rsa_id,
          campaign_id: camp.id,
          source: "creative_swap_copilot",
        };

  const row = await prisma.paidAdsChangeRequest.create({
    data: {
      userId: project.userId,
      projectId: args.projectId,
      type,
      payload: payload as Prisma.InputJsonValue,
      status: "pending",
      requestedById: args.requestedById,
    },
  });

  let status = "pending";
  let applyError: string | undefined;

  if (project.paidMode === "autopilot") {
    const now = new Date();
    const pre = await workspaceAllowsApplyBeforeRemote(args.projectId, type, payload);
    if (!pre.ok) {
      await prisma.paidAdsChangeRequest.update({
        where: { id: row.id },
        data: {
          status: "failed",
          errorMessage: pre.message,
          reviewedAt: now,
          reviewedById: args.requestedById,
        },
      });
      status = "failed";
      applyError = pre.message;
    } else {
      const out = await applyChangeRequestRemote(args.projectId, type, payload);
      if (!out.ok) {
        await prisma.paidAdsChangeRequest.update({
          where: { id: row.id },
          data: {
            status: "failed",
            errorMessage: out.error,
            reviewedAt: now,
            reviewedById: args.requestedById,
          },
        });
        status = "failed";
        applyError = out.error;
      } else {
        await prisma.paidAdsChangeRequest.update({
          where: { id: row.id },
          data: {
            status: "applied",
            appliedAt: now,
            reviewedAt: now,
            reviewedById: args.requestedById,
          },
        });
        status = "applied";
      }
    }
  }

  // Keep the CTR suggestion visible so the user can retry after a failed Autopilot apply.
  let flagCleared = false;
  if (!applyError) {
    const cleared = await clearCreativeSwapFlag({
      projectId: args.projectId,
      campaignId: args.campaignId,
    });
    flagCleared = !("error" in cleared);
  }

  return {
    ok: true,
    change_request_id: row.id,
    change_request_status: status,
    next_action: resolved.action,
    flag_cleared: flagCleared,
    ...(applyError ? { apply_error: applyError } : {}),
  };
}

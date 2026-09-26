/**
 * TikTok Marketing API: campanha + ad group + anúncio (vídeo ou imagem).
 * O material vem do payload do plano: ficheiro carregado no assistente, URL pública
 * ou `video_id` / `image_ids` já existentes na biblioteca do advertiser.
 */
import { paidLog } from "../lib/paidLog";
import { tiktokAdgroupBidExtras } from "./meta-tiktok-bidding";
import { prisma } from "./paidPrisma";
import {
  buildTikTokAdCreative,
  createTikTokAd,
  ensureTikTokIdentity,
  extractTikTokCreativeSource,
  hasTikTokCreativeSource,
  resolveTikTokCreativeAssets,
  tiktokCallToActionFromObjective,
} from "./tiktok-ads.creative";
import { tiktokApiPostWithTokenRetry } from "./tiktok-oauth.api";

type TikTokApiEnvelope<T = unknown> = {
  code: number;
  message: string;
  data?: T;
  request_id?: string;
};

export type TikTokPublishResult = { ok: true; ad_id?: string } | { ok: false; error: string };

const TT_US = "6252001";

const ISO2_TO_TT_LOCATION: Record<string, string> = {
  US: TT_US,
  CA: "6251999",
  GB: "2635167",
  UK: "2635167",
  DE: "2921044",
  FR: "3017382",
  ES: "2510769",
  IT: "3175395",
  PT: "2440472",
  BR: "2802361",
  MX: "3996063",
  AU: "2077456",
  JP: "1861060",
  IN: "10264337",
  NL: "3017924",
  PL: "3057568",
  SE: "2661886",
  NO: "3144096",
  CH: "2658434",
  AT: "2782113",
  BE: "2802360",
};

function nextScheduleStartTimeUtc(): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function resolveTikTokLocationIds(geo: unknown): { ids: string[]; unmappedIso2: string[] } {
  if (!Array.isArray(geo) || !geo.length) {
    return { ids: [TT_US], unmappedIso2: [] };
  }
  const out: string[] = [];
  const unmapped: string[] = [];
  for (const g of geo) {
    const code = String(g)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
    if (!code) continue;
    const id = ISO2_TO_TT_LOCATION[code];
    if (!id) {
      unmapped.push(code);
      if (!out.includes(TT_US)) out.push(TT_US);
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  return { ids: out.length ? out : [TT_US], unmappedIso2: unmapped };
}

const DEFAULT_OBJECTIVE = "TRAFFIC";

function objectiveFromCrPayload(crPayload: Record<string, unknown> | undefined): string {
  const v = crPayload && typeof crPayload["objective_type"] === "string" ? crPayload["objective_type"] : null;
  if (v && v.length > 0 && v.length < 64) return v;
  return DEFAULT_OBJECTIVE;
}

/**
 * Cria campanha + ad group + anúncio. O anúncio só é criado quando o payload traz
 * material (ficheiro, URL ou id); sem material fica campanha + ad group.
 */
export async function publishTikTokCreateCampaignFromLocal(
  projectId: string,
  campaignId: string,
  crPayload?: Record<string, unknown>,
): Promise<TikTokPublishResult> {
  const objectiveType = objectiveFromCrPayload(crPayload);
  const conn = await prisma.paidAdsTikTokConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.advertiserId) {
    return { ok: false, error: "Ligue a conta TikTok (OAuth) e o advertiser em contexto." };
  }

  const campaign = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "tiktok_ads" },
  });
  if (!campaign) {
    return { ok: false, error: "Campanha TikTok não encontrada." };
  }

  const creativeSource = extractTikTokCreativeSource(crPayload);
  const wantsAd = hasTikTokCreativeSource(creativeSource);
  const alreadyComplete = Boolean(campaign.externalCampaignId && campaign.tiktokAdGroupId);
  if (alreadyComplete && (!wantsAd || campaign.tiktokAdId)) {
    return { ok: true, ...(campaign.tiktokAdId ? { ad_id: campaign.tiktokAdId } : {}) };
  }

  const daily =
    campaign.dailyBudgetMicros != null ? Number(campaign.dailyBudgetMicros) / 1_000_000 : 50;
  const budget = Math.max(20, Math.round(daily * 100) / 100);
  const { ids: locationIds, unmappedIso2 } = resolveTikTokLocationIds(campaign.geoTargets);
  if (unmappedIso2.length) {
    paidLog("warn", "tiktok.publish.unmapped_geo", {
      projectId,
      campaignId,
      unmappedIso2,
      fallbackUsed: locationIds,
    });
  }

  try {
    let remoteCampaignId = campaign.externalCampaignId;
    let adGroupId = campaign.tiktokAdGroupId;

    if (!remoteCampaignId) {
      const cRes = (await tiktokApiPostWithTokenRetry<{ campaign_id: string }>(
        projectId,
        `campaign/create/`,
        {
          advertiser_id: conn.advertiserId,
          campaign_name: campaign.name.slice(0, 500),
          objective_type: objectiveType,
          budget_mode: "BUDGET_MODE_INFINITE",
          operation_status: "ENABLE",
        },
      )) as TikTokApiEnvelope<{ campaign_id: string }>;
      if (cRes.code !== 0 || !cRes.data?.campaign_id) {
        paidLog("error", "tiktok.publish.campaign_create", {
          projectId,
          campaignId,
          code: cRes.code,
          message: cRes.message,
          requestId: cRes.request_id,
        });
        return { ok: false, error: cRes.message || `TikTok campaign (code ${cRes.code})` };
      }
      remoteCampaignId = String(cRes.data.campaign_id);
      await prisma.paidAdsCampaign.update({
        where: { id: campaign.id },
        data: { externalCampaignId: remoteCampaignId, status: "live" },
      });
    }

    if (!adGroupId) {
      const agName = `${campaign.name} — G1`.slice(0, 512);
      const bidExtras = tiktokAdgroupBidExtras(campaign.biddingConfig);
      const agBody = {
        advertiser_id: conn.advertiserId,
        campaign_id: remoteCampaignId!,
        adgroup_name: agName,
        budget,
        budget_mode: "BUDGET_MODE_DAY",
        billing_event: "OCPM",
        optimization_goal: "CLICK",
        pacing: "PACING_MODE_SMOOTH",
        placement_type: "PLACEMENT_TYPE_NORMAL",
        placements: ["PLACEMENT_TIKTOK"],
        schedule_type: "SCHEDULE_FROM_NOW",
        schedule_start_time: nextScheduleStartTimeUtc(),
        location_ids: locationIds,
        operation_status: "ENABLE",
        ...bidExtras,
      };
      const agRes = (await tiktokApiPostWithTokenRetry<{ adgroup_id?: string; ad_group_id?: string }>(
        projectId,
        `adgroup/create/`,
        agBody,
      )) as TikTokApiEnvelope<{ adgroup_id?: string; ad_group_id?: string }>;
      const agId = agRes.data?.adgroup_id ?? agRes.data?.ad_group_id;
      if (agRes.code !== 0 || !agId) {
        paidLog("error", "tiktok.publish.adgroup_create", {
          projectId,
          campaignId,
          code: agRes.code,
          message: agRes.message,
          requestId: agRes.request_id,
        });
        return {
          ok: false,
          error:
            agRes.message ||
            `TikTok ad group (code ${agRes.code}) — campanha remota: ${remoteCampaignId}`,
        };
      }
      adGroupId = String(agId);
      await prisma.paidAdsCampaign.update({
        where: { id: campaign.id },
        data: { tiktokAdGroupId: adGroupId },
      });
    }

    /** Sem material no plano: campanha e ad group ficam prontos, o anúncio é criado mais tarde. */
    if (!wantsAd) {
      paidLog("warn", "tiktok.publish.ad_skipped_no_creative", { projectId, campaignId });
      return { ok: true };
    }
    if (campaign.tiktokAdId) {
      return { ok: true, ad_id: campaign.tiktokAdId };
    }

    const landing = creativeSource.landingUrl;
    if (!landing) {
      return {
        ok: false,
        error: "URL de destino em falta: sem ela o TikTok não aceita o anúncio.",
      };
    }

    const identity = await ensureTikTokIdentity(
      projectId,
      conn.advertiserId,
      creativeSource.displayName ?? campaign.name,
      creativeSource.identityId ?? campaign.tiktokIdentityId,
    );
    if (!identity.ok) {
      return { ok: false, error: identity.error };
    }
    if (identity.identityId !== campaign.tiktokIdentityId) {
      await prisma.paidAdsCampaign.update({
        where: { id: campaign.id },
        data: { tiktokIdentityId: identity.identityId },
      });
    }

    const assets = await resolveTikTokCreativeAssets(projectId, conn.advertiserId, creativeSource);
    if (!assets.ok) {
      return { ok: false, error: assets.error };
    }

    const ad = await createTikTokAd(projectId, {
      advertiserId: conn.advertiserId,
      adgroupId: adGroupId!,
      creative: buildTikTokAdCreative({
        adName: `${campaign.name} — Ad`,
        identityId: identity.identityId,
        videoId: assets.creative.videoId,
        imageIds: assets.creative.imageIds,
        adText: creativeSource.adText ?? campaign.objectiveSummary ?? campaign.name,
        callToAction: creativeSource.callToAction ?? tiktokCallToActionFromObjective(objectiveType),
        landingPageUrl: landing,
        displayName: creativeSource.displayName ?? campaign.name,
      }),
    });
    if (!ad.ok) {
      return { ok: false, error: ad.error };
    }

    await prisma.paidAdsCampaign.update({
      where: { id: campaign.id },
      data: { tiktokAdId: ad.adId },
    });
    paidLog("info", "tiktok.publish.ad_created", {
      projectId,
      campaignId,
      adId: ad.adId,
      format: assets.creative.videoId ? "SINGLE_VIDEO" : "SINGLE_IMAGE",
    });
    return { ok: true, ad_id: ad.adId };
  } catch (e) {
    const m = e instanceof Error ? e.message : "Falha na API TikTok.";
    paidLog("error", "tiktok.publish.exception", { projectId, campaignId, message: m });
    return { ok: false, error: m };
  }
}

/**
 * TikTok Marketing API (v1.3): cria campanha (orçamento infinito a nível campanha)
 * + ad group com orçamento diário. Anúncios (vídeo) requerem passos adicionais.
 */
import { paidLog } from "../lib/paidLog";
import { prisma } from "./paidPrisma";
import { tiktokApiPostWithTokenRetry } from "./tiktok-oauth.api";

type TikTokApiEnvelope<T = unknown> = {
  code: number;
  message: string;
  data?: T;
  request_id?: string;
};

export type TikTokPublishResult = { ok: true } | { ok: false; error: string };

const TT_US = "6252001";

/** IDs de região TikTok (Marketing API) — ampliar conforme necessário. */
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
      const fallback = TT_US;
      if (!out.includes(fallback)) out.push(fallback);
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
 * Cria campanha + ad group; grava `externalCampaignId` e `tiktokAdGroupId` quando bem-sucedido.
 * Recupera ad group se já existir campanha remota sem ad group local.
 * `crPayload` (opcional): vindo do pedido de alteração, usa `objective_type` (ex.: TRAFFIC) no create remoto.
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

  if (campaign.externalCampaignId && campaign.tiktokAdGroupId) {
    return { ok: true };
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

    if (!campaign.tiktokAdGroupId) {
      const agName = `${campaign.name} — G1`.slice(0, 512);
      const agRes = (await tiktokApiPostWithTokenRetry<{ adgroup_id?: string; ad_group_id?: string }>(
        projectId,
        `adgroup/create/`,
        {
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
        },
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
      await prisma.paidAdsCampaign.update({
        where: { id: campaign.id },
        data: { tiktokAdGroupId: String(agId) },
      });
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "Falha na API TikTok.";
    paidLog("error", "tiktok.publish.exception", { projectId, campaignId, message: m });
    return { ok: false, error: m };
  }

  return { ok: true };
}

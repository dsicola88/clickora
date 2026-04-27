/**
 * TikTok Marketing API (v1.3): cria campanha (orçamento infinito a nível campanha)
 * + ad group com orçamento diário. Anúncios (vídeo) requerem passos adicionais.
 */
import { prisma } from "./prisma";

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";

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

function resolveTikTokLocationIds(geo: unknown): string[] {
  if (!Array.isArray(geo) || !geo.length) {
    return [TT_US];
  }
  const out: string[] = [];
  for (const g of geo) {
    const code = String(g)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
    const id = ISO2_TO_TT_LOCATION[code] ?? TT_US;
    if (!out.includes(id)) out.push(id);
  }
  return out.length ? out : [TT_US];
}

async function tiktokPost<T>(
  path: string,
  accessToken: string,
  body: object,
): Promise<TikTokApiEnvelope<T>> {
  const res = await fetch(`${TIKTOK_BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TikTokApiEnvelope<T>;
}

/**
 * Cria campanha + ad group; grava `externalCampaignId` e `tiktokAdGroupId` quando bem-sucedido.
 * Recupera ad group se já existir campanha remota sem ad group local.
 */
export async function publishTikTokCreateCampaignFromLocal(
  projectId: string,
  campaignId: string,
): Promise<TikTokPublishResult> {
  const conn = await prisma.tikTokConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.advertiserId) {
    return { ok: false, error: "Ligue a conta TikTok (OAuth) e o advertiser em contexto." };
  }

  const campaign = await prisma.paidCampaign.findFirst({
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
  const locationIds = resolveTikTokLocationIds(campaign.geoTargets);

  try {
    let remoteCampaignId = campaign.externalCampaignId;

    if (!remoteCampaignId) {
      const cRes = await tiktokPost<{ campaign_id: string }>(`campaign/create/`, conn.tokenRef, {
        advertiser_id: conn.advertiserId,
        campaign_name: campaign.name.slice(0, 500),
        objective_type: "TRAFFIC",
        budget_mode: "BUDGET_MODE_INFINITE",
        operation_status: "ENABLE",
      });
      if (cRes.code !== 0 || !cRes.data?.campaign_id) {
        return { ok: false, error: cRes.message || `TikTok campaign (code ${cRes.code})` };
      }
      remoteCampaignId = String(cRes.data.campaign_id);
      await prisma.paidCampaign.update({
        where: { id: campaign.id },
        data: { externalCampaignId: remoteCampaignId, status: "live" },
      });
    }

    if (!campaign.tiktokAdGroupId) {
      const agName = `${campaign.name} — G1`.slice(0, 512);
      const agRes = await tiktokPost<{ adgroup_id?: string; ad_group_id?: string }>(
        `adgroup/create/`,
        conn.tokenRef,
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
      );
      const agId = agRes.data?.adgroup_id ?? agRes.data?.ad_group_id;
      if (agRes.code !== 0 || !agId) {
        return {
          ok: false,
          error:
            agRes.message ||
            `TikTok ad group (code ${agRes.code}) — campanha remota: ${remoteCampaignId}`,
        };
      }
      await prisma.paidCampaign.update({
        where: { id: campaign.id },
        data: { tiktokAdGroupId: String(agId) },
      });
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "Falha na API TikTok.";
    return { ok: false, error: m };
  }

  return { ok: true };
}

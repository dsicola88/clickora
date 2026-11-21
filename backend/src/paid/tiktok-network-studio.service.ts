/**
 * Acções day-to-day TikTok (pause/resume/budget) via change requests.
 */
import { z } from "zod";

import { submitNetworkStudioChangeRequest } from "./network-studio-submit";
import { prisma } from "./paidPrisma";

const tiktokStudioActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause_campaign") }),
  z.object({ action: z.literal("resume_campaign") }),
  z.object({
    action: z.literal("update_budget_usd"),
    daily_budget_usd: z.number().finite().min(1).max(1_000_000),
  }),
  z.object({
    action: z.literal("publish_ad"),
    landing_url: z.string().url().max(2000),
    video_asset_path: z.string().max(512).optional(),
    video_url: z.string().url().max(2000).optional(),
    video_id: z.string().max(128).optional(),
    image_url: z.string().url().max(2000).optional(),
    ad_text: z.string().max(100).optional(),
    display_name: z.string().max(40).optional(),
  }),
]);

export async function executeTiktokStudioAction(
  projectId: string,
  campaignId: string,
  body: unknown,
  requestedById: string,
): Promise<
  | { ok: true; change_request: { id: string; status: string } }
  | { ok: false; error: string; change_request_id?: string }
> {
  const parsed = tiktokStudioActionSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Pedido inválido." };
  }

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "tiktok_ads" },
  });
  if (!camp) return { ok: false, error: "Campanha TikTok não encontrada." };
  if (camp.status === "archived") return { ok: false, error: "Campanha arquivada." };
  if (!camp.externalCampaignId) {
    return {
      ok: false,
      error: "Publique a campanha no TikTok antes de alterações ao vivo.",
    };
  }

  const submit = async (
    type:
      | "tiktok_pause_entity"
      | "tiktok_resume_entity"
      | "tiktok_update_budget"
      | "tiktok_publish_creative",
    payload: Record<string, unknown>,
  ) => {
    const r = await submitNetworkStudioChangeRequest({
      projectId,
      campaignId,
      type,
      payload,
      requestedById,
    });
    if (r.error) {
      return { ok: false as const, error: r.error, change_request_id: r.id };
    }
    return { ok: true as const, change_request: { id: r.id, status: r.status } };
  };

  const a = parsed.data;
  switch (a.action) {
    case "pause_campaign":
      return submit("tiktok_pause_entity", { level: "campaign", campaign_id: campaignId });
    case "resume_campaign":
      return submit("tiktok_resume_entity", { level: "campaign", campaign_id: campaignId });
    case "update_budget_usd": {
      const daily_budget_micros = Math.round(a.daily_budget_usd * 1_000_000);
      return submit("tiktok_update_budget", {
        level: "campaign",
        campaign_id: campaignId,
        daily_budget_micros,
      });
    }
    case "publish_ad": {
      if (!camp.tiktokAdGroupId) {
        return {
          ok: false,
          error: "Sem ad group remoto — publique a campanha TikTok antes de anexar o anúncio.",
        };
      }
      if (camp.tiktokAdId) {
        return { ok: false, error: "Esta campanha já tem anúncio TikTok." };
      }
      if (!a.video_asset_path && !a.video_url && !a.video_id && !a.image_url) {
        return {
          ok: false,
          error: "Indique material: video_asset_path, video_url, video_id ou image_url.",
        };
      }
      return submit("tiktok_publish_creative", {
        campaign_id: campaignId,
        landing_url: a.landing_url,
        ...(a.video_asset_path ? { video_asset_path: a.video_asset_path } : {}),
        ...(a.video_url ? { video_url: a.video_url } : {}),
        ...(a.video_id ? { video_id: a.video_id } : {}),
        ...(a.image_url ? { image_url: a.image_url } : {}),
        ...(a.ad_text ? { ad_text: a.ad_text } : {}),
        ...(a.display_name ? { display_name: a.display_name } : {}),
      });
    }
    default:
      return { ok: false, error: "Acção não suportada." };
  }
}

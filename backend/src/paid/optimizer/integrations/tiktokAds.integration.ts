/**
 * Integração TikTok Ads — pausa campanha e orçamento diário.
 */
import { applyTiktokPauseEntity, applyTiktokUpdateBudget } from "../../tiktok-ads.mutations";

export async function pauseCampaign(projectId: string, paidCampaignId: string) {
  return applyTiktokPauseEntity(projectId, { level: "campaign", campaign_id: paidCampaignId });
}

export async function updateCampaignDailyBudgetMicros(
  projectId: string,
  paidCampaignId: string,
  dailyBudgetMicros: number,
) {
  return applyTiktokUpdateBudget(projectId, {
    level: "campaign",
    campaign_id: paidCampaignId,
    daily_budget_micros: dailyBudgetMicros,
  });
}

/**
 * Integração TikTok Ads — pausa/retoma campanha e orçamento diário.
 */
import {
  applyTiktokPauseEntity,
  applyTiktokResumeEntity,
  applyTiktokUpdateBudget,
} from "../../tiktok-ads.mutations";

export async function pauseCampaign(projectId: string, paidCampaignId: string) {
  return applyTiktokPauseEntity(projectId, { level: "campaign", campaign_id: paidCampaignId });
}

export async function resumeCampaign(projectId: string, paidCampaignId: string) {
  return applyTiktokResumeEntity(projectId, { level: "campaign", campaign_id: paidCampaignId });
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

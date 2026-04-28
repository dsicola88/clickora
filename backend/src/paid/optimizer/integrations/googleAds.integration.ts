/**
 * Integração Google Ads — pausa e orçamento (delega às mutações existentes).
 */
import { applyGooglePauseEntity, applyGoogleUpdateBudget } from "../../google-ads.mutations";

export async function pauseCampaign(projectId: string, paidCampaignId: string) {
  return applyGooglePauseEntity(projectId, { entity: "campaign", id: paidCampaignId });
}

export async function updateCampaignDailyBudgetMicros(
  projectId: string,
  paidCampaignId: string,
  dailyBudgetMicros: number,
) {
  return applyGoogleUpdateBudget(projectId, {
    campaign_id: paidCampaignId,
    daily_budget_micros: dailyBudgetMicros,
  });
}

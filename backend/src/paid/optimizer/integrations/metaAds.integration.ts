/**
 * Integração Meta Ads — pausa/retoma campanha e orçamento do ad set.
 */
import {
  applyMetaAdsetDailyBudget,
  applyMetaPauseEntity,
  applyMetaResumeEntity,
} from "../../meta-ads.mutations";

export async function pauseCampaign(projectId: string, paidCampaignId: string) {
  return applyMetaPauseEntity(projectId, { level: "campaign", id: paidCampaignId });
}

export async function resumeCampaign(projectId: string, paidCampaignId: string) {
  return applyMetaResumeEntity(projectId, { level: "campaign", id: paidCampaignId });
}

export async function updateAdsetDailyBudgetCents(projectId: string, metaAdsetId: string, dailyBudgetCents: number) {
  return applyMetaAdsetDailyBudget(projectId, {
    meta_adset_id: metaAdsetId,
    daily_budget_cents: dailyBudgetCents,
  });
}

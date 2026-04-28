import type {
  PaidAdsAiRun,
  PaidAdsGoogleAdsConnection,
  PaidAdsMetaConnection,
  PaidAdsCampaign,
  PaidAdsChangeRequest,
  PaidAdsGuardrails,
  PaidAdsOptimizerDecision,
  PaidAdsProject,
  PaidAdsTikTokConnection,
} from "@prisma/client";

/** DTOs em snake_case (organization_id = user_id do tenant, compat. UI). */

export function mapGuardrails(g: PaidAdsGuardrails) {
  return {
    id: g.id,
    project_id: g.projectId,
    max_daily_budget_micros: Number(g.maxDailyBudgetMicros),
    max_monthly_spend_micros: Number(g.maxMonthlySpendMicros),
    max_cpc_micros: g.maxCpcMicros != null ? Number(g.maxCpcMicros) : null,
    allowed_countries: g.allowedCountries,
    blocked_keywords: g.blockedKeywords,
    require_approval_above_micros:
      g.requireApprovalAboveMicros != null ? Number(g.requireApprovalAboveMicros) : null,
    created_at: g.createdAt.toISOString(),
    updated_at: g.updatedAt.toISOString(),
  };
}

export function mapGoogleAdsConnection(c: PaidAdsGoogleAdsConnection) {
  return {
    id: c.id,
    user_id: c.userId,
    organization_id: c.userId,
    project_id: c.projectId,
    google_customer_id: c.googleCustomerId,
    account_name: c.accountName,
    status: c.status,
    token_ref: c.tokenRef,
    last_sync_at: c.lastSyncAt?.toISOString() ?? null,
    error_message: c.errorMessage,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function mapMetaConnection(c: PaidAdsMetaConnection) {
  return {
    id: c.id,
    user_id: c.userId,
    organization_id: c.userId,
    project_id: c.projectId,
    ad_account_id: c.adAccountId,
    business_id: c.businessId,
    account_name: c.accountName,
    status: c.status,
    token_ref: c.tokenRef,
    last_sync_at: c.lastSyncAt?.toISOString() ?? null,
    error_message: c.errorMessage,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function mapTikTokConnection(c: PaidAdsTikTokConnection) {
  return {
    id: c.id,
    user_id: c.userId,
    organization_id: c.userId,
    project_id: c.projectId,
    advertiser_id: c.advertiserId,
    account_name: c.accountName,
    status: c.status,
    token_ref: c.tokenRef,
    refresh_token_ref: c.refreshTokenRef,
    last_sync_at: c.lastSyncAt?.toISOString() ?? null,
    error_message: c.errorMessage,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function mapPaidCampaign(c: PaidAdsCampaign) {
  return {
    id: c.id,
    user_id: c.userId,
    organization_id: c.userId,
    project_id: c.projectId,
    platform: c.platform,
    external_campaign_id: c.externalCampaignId,
    tiktok_ad_group_id: c.tiktokAdGroupId,
    name: c.name,
    status: c.status,
    objective_summary: c.objectiveSummary,
    daily_budget_micros: c.dailyBudgetMicros != null ? Number(c.dailyBudgetMicros) : null,
    geo_targets: c.geoTargets,
    language_targets: c.languageTargets,
    /** JSON do motor automático (ex.: sugestão de troca de criativo). */
    optimizer_flags:
      c.optimizerFlags && typeof c.optimizerFlags === "object" && !Array.isArray(c.optimizerFlags)
        ? (c.optimizerFlags as Record<string, unknown>)
        : {},
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function mapChangeRequest(cr: PaidAdsChangeRequest) {
  return {
    id: cr.id,
    user_id: cr.userId,
    organization_id: cr.userId,
    project_id: cr.projectId,
    type: cr.type,
    payload: cr.payload,
    status: cr.status,
    requested_by: cr.requestedById,
    reviewed_by: cr.reviewedById,
    reviewed_at: cr.reviewedAt?.toISOString() ?? null,
    applied_at: cr.appliedAt?.toISOString() ?? null,
    error_message: cr.errorMessage,
    created_at: cr.createdAt.toISOString(),
    updated_at: cr.updatedAt.toISOString(),
  };
}

export function mapAiRun(r: PaidAdsAiRun) {
  return {
    id: r.id,
    user_id: r.userId,
    organization_id: r.userId,
    project_id: r.projectId,
    feature: r.feature,
    model: r.model,
    prompt_version: r.promptVersion,
    input_summary: r.inputSummary,
    output_summary: r.outputSummary,
    tokens_in: r.tokensIn,
    tokens_out: r.tokensOut,
    estimated_cost_usd: r.estimatedCostUsd != null ? Number(r.estimatedCostUsd) : null,
    status: r.status,
    error_message: r.errorMessage,
    created_by: r.createdById,
    created_at: r.createdAt.toISOString(),
  };
}

export function mapProjectMode(p: Pick<PaidAdsProject, "paidMode">) {
  return { paid_mode: p.paidMode };
}

export function mapOptimizerDecision(
  d: PaidAdsOptimizerDecision & { campaign?: Pick<PaidAdsCampaign, "name"> | null },
) {
  const snap =
    d.inputSnapshot && typeof d.inputSnapshot === "object" && !Array.isArray(d.inputSnapshot)
      ? (d.inputSnapshot as Record<string, unknown>)
      : {};

  return {
    id: d.id,
    project_id: d.projectId,
    campaign_id: d.campaignId,
    campaign_name: d.campaign?.name ?? null,
    platform: d.platform,
    rule_code: d.ruleCode,
    decision_type: d.decisionType,
    dry_run: d.dryRun,
    input_snapshot: snap,
    executed: d.executed,
    execution_ok: d.executionOk,
    execution_detail: d.executionDetail,
    created_at: d.createdAt.toISOString(),
  };
}

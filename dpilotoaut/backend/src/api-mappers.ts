import type {
  AiRun,
  GoogleAdsConnection,
  MetaConnection,
  PaidCampaign,
  PaidChangeRequest,
  PaidGuardrails,
  Project,
  TikTokConnection,
} from "@prisma/client";

/** DTOs em snake_case para compatibilidade com a UI existente. */

export function mapGuardrails(g: PaidGuardrails) {
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

export function mapGoogleAdsConnection(c: GoogleAdsConnection) {
  return {
    id: c.id,
    organization_id: c.organizationId,
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

export function mapMetaConnection(c: MetaConnection) {
  return {
    id: c.id,
    organization_id: c.organizationId,
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

export function mapTikTokConnection(c: TikTokConnection) {
  return {
    id: c.id,
    organization_id: c.organizationId,
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

export function mapPaidCampaign(c: PaidCampaign) {
  return {
    id: c.id,
    organization_id: c.organizationId,
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
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  };
}

export function mapChangeRequest(cr: PaidChangeRequest) {
  return {
    id: cr.id,
    organization_id: cr.organizationId,
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

export function mapAiRun(r: AiRun) {
  return {
    id: r.id,
    organization_id: r.organizationId,
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

export function mapProjectMode(p: Pick<Project, "paidMode">) {
  return { paid_mode: p.paidMode };
}

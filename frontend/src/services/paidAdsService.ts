import { apiClient } from "@/lib/apiClient";

export type PaidAdsProjectRow = { id: string; name: string; createdAt: string };

export type PaidOverviewDto = {
  project: { paid_mode: string };
  connection: {
    id: string;
    status: string;
    google_customer_id: string | null;
    account_name: string | null;
    error_message: string | null;
  };
  guardrails: Record<string, unknown>;
  pending_approvals: number;
};

export type OauthConfigDto = {
  google: { available: boolean };
  meta: { available: boolean; appId: string | null };
  tiktok: { available: boolean; appId: string | null };
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  platform: string;
  created_at: string;
  /** Presente quando a campanha chegou a ter ID na rede (Google/Meta/TikTok). */
  external_campaign_id?: string | null;
  daily_budget_micros?: number | null;
  /** Códigos ISO de país (segmentação). */
  geo_targets?: string[] | null;
  /** Preferências de licitação por rede (Google/Meta/TikTok) conforme backend. */
  bidding_config?: Record<string, unknown>;
  /** Override optimizer: USD pause sem conversão (null = política do projecto). */
  optimizer_pause_spend_usd?: number | null;
  optimizer_pause_min_clicks?: number | null;
  /** Sinais do optimizador automático (backend); ex. sugestão de criativo. */
  optimizer_flags?: Record<string, unknown>;
};

export type GoogleStudioKeywordRow = {
  id: string;
  text: string;
  match_type: string;
  status: string;
  external_criterion_id?: string | null;
};

export type GoogleStudioRsaRow = {
  id: string;
  headlines: string[];
  descriptions: string[];
  final_urls: string[];
  status: string;
  external_ad_id: string | null;
};

export type GoogleStudioAdGroupRow = {
  id: string;
  name: string;
  status: string;
  external_ad_group_id: string | null;
  cpc_bid_micros: number | null;
  keywords: GoogleStudioKeywordRow[];
  rsa: GoogleStudioRsaRow[];
};

export type GoogleCampaignStudioDto = {
  campaign: CampaignRow & { objective_summary?: string | null; language_targets?: string[] };
  published: boolean;
  ad_groups: GoogleStudioAdGroupRow[];
};

export type ChangeRequestRow = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  error_message: string | null;
  /** Resumo técnico do pedido (landing, geo, orçamento, razões dos guardrails). */
  payload?: Record<string, unknown> | null;
};

/** Resposta ao gerar plano (assistentes Google / Meta / TikTok). `planSource` distingue IA, fallback e plano manual. */
export type CampaignPlanAssistantOk = {
  ok: boolean;
  campaignId: string;
  model: string;
  planSource: "llm" | "deterministic" | "manual";
  autoApplied: boolean;
  reasons: { code: string; message: string }[];
};

/** Linha de auditoria do motor automático (`paid_ads_optimizer_decisions`). */
export type OptimizerDecisionRow = {
  id: string;
  project_id: string;
  campaign_id: string;
  campaign_name: string | null;
  platform: string;
  rule_code: string;
  decision_type: string;
  dry_run: boolean;
  input_snapshot: Record<string, unknown>;
  executed: boolean;
  execution_ok: boolean | null;
  execution_detail: string | null;
  created_at: string;
};

export type OptimizerDecisionsPagination = {
  limit: number;
  offset: number;
  total: number;
};

export const paidAdsService = {
  getOauthConfig() {
    return apiClient.get<OauthConfigDto>("/paid/oauth/config");
  },

  listProjects() {
    return apiClient.get<{ projects: PaidAdsProjectRow[] }>("/paid/projects");
  },

  getOverview(projectId: string) {
    return apiClient.get<PaidOverviewDto>(`/paid/projects/${projectId}/overview`);
  },

  listCampaigns(
    projectId: string,
    opts?: {
      platform?: "google_ads" | "meta_ads" | "tiktok_ads";
      status?:
        | "draft"
        | "pending_publish"
        | "live"
        | "paused"
        | "archived"
        | "error";
    },
  ) {
    const sp = new URLSearchParams();
    if (opts?.platform) sp.set("platform", opts.platform);
    if (opts?.status) sp.set("status", opts.status);
    const q = sp.toString() ? `?${sp.toString()}` : "";
    return apiClient.get<{ campaigns: CampaignRow[] }>(`/paid/projects/${projectId}/campaigns${q}`);
  },

  /** Histórico paginado do motor automático (pausa, escala, flags CTR). */
  listOptimizerDecisions(projectId: string, opts?: { limit?: number; offset?: number }) {
    const sp = new URLSearchParams();
    if (opts?.limit != null) sp.set("limit", String(opts.limit));
    if (opts?.offset != null) sp.set("offset", String(opts.offset));
    const q = sp.toString() ? `?${sp.toString()}` : "";
    return apiClient.get<{
      decisions: OptimizerDecisionRow[];
      pagination: OptimizerDecisionsPagination;
    }>(`/paid/projects/${projectId}/optimizer-decisions${q}`);
  },

  listChangeRequests(projectId: string) {
    return apiClient.get<{ change_requests: ChangeRequestRow[] }>(`/paid/projects/${projectId}/change-requests`);
  },

  reviewChangeRequest(body: { id: string; status: "approved" | "rejected" | "applied" }) {
    return apiClient.post<{ ok: boolean }>("/paid/change-requests/review", body);
  },

  getMetaConnection(projectId: string) {
    return apiClient.get<Record<string, unknown> | null>(`/paid/projects/${projectId}/meta-connection`);
  },

  getTikTokConnection(projectId: string) {
    return apiClient.get<Record<string, unknown> | null>(`/paid/projects/${projectId}/tiktok-connection`);
  },

  googleOAuthStart(projectId: string) {
    return apiClient.post<{ url: string }>("/paid/oauth/google/start", { projectId });
  },

  metaOAuthStart(projectId: string) {
    return apiClient.post<{ url: string }>("/paid/oauth/meta/start", { projectId });
  },

  tiktokOAuthStart(projectId: string) {
    return apiClient.post<{ url: string }>("/paid/oauth/tiktok/start", { projectId });
  },

  disconnectGoogle(projectId: string) {
    return apiClient.post<{ ok: boolean }>("/paid/oauth/google/disconnect", { projectId });
  },

  disconnectMeta(projectId: string) {
    return apiClient.post<{ ok: boolean }>("/paid/oauth/meta/disconnect", { projectId });
  },

  disconnectTiktok(projectId: string) {
    return apiClient.post<{ ok: boolean }>("/paid/oauth/tiktok/disconnect", { projectId });
  },

  getMetaOverview(projectId: string) {
    return apiClient.get<{
      campaigns: number;
      drafts: number;
      pending: number;
      creatives: number;
    }>(`/paid/projects/${projectId}/meta-overview`);
  },

  getTikTokOverview(projectId: string) {
    return apiClient.get<{ campaigns: number; drafts: number; pending: number }>(
      `/paid/projects/${projectId}/tiktok-overview`,
    );
  },

  listAiRuns(projectId: string) {
    return apiClient.get<{ ai_runs: Record<string, unknown>[] }>(`/paid/projects/${projectId}/ai-runs`);
  },

  /**
   * Alinha o estado `PaidAdsCampaign` com as redes (ids externos já gravados).
   * Requer ligação OAuth activa por plataforma; erros vêm no array `errors`.
   */
  reconcileCampaigns(projectId: string) {
    return apiClient.post<{
      ok: true;
      updated: {
        campaign_id: string;
        platform: string;
        before: string;
        after: string;
        remote: string;
      }[];
      errors: { campaign_id: string; platform: string; error: string }[];
      skipped: { campaign_id: string; reason: string }[];
    }>(`/paid/projects/${projectId}/reconcile-campaigns`, {});
  },

  updatePaidMode(projectId: string, paidMode: "copilot" | "autopilot") {
    return apiClient.post<{ ok: boolean }>(`/paid/projects/${projectId}/paid-mode`, { paidMode });
  },

  upsertGuardrails(body: {
    projectId: string;
    max_daily_budget_micros: number;
    max_monthly_spend_micros: number;
    max_cpc_micros: number | null;
    allowed_countries: string[];
    blocked_keywords: string[];
    require_approval_above_micros: number | null;
    optimizer_pause_spend_usd?: number | null;
    optimizer_pause_min_clicks?: number | null;
  }) {
    return apiClient.post<Record<string, unknown>>("/paid/guardrails", body);
  },

  /**
   * Lê a landing e devolve dados detectados (oferta sugerida, idioma, sinais
   * reais do produto). O utilizador valida/edita antes de submeter o plano.
   */
  extractGoogleLanding(projectId: string, body: { landingUrl: string }) {
    return apiClient.post<{
      ok: true;
      url: string;
      hostname: string;
      language: string | null;
      offer_suggestion: string | null;
      signals: {
        price?: string;
        price_full?: string;
        discount?: string;
        guarantee?: string;
        shipping?: string;
        bundles?: string[];
        bonuses?: string;
        certifications?: string;
        attributes?: string[];
      };
      sources: Record<string, string | undefined>;
    }>(`/paid/projects/${projectId}/google-landing-extract`, body);
  },

  postGoogleKeywordInsight(
    projectId: string,
    body: {
      keyword: string;
      countryCode: string;
      /** Até 10 países ISO — mesmo pedido que o Keyword Planner multi-localização. */
      countryCodes?: string[];
      languageCode: string;
      userCpcUsd?: number;
      dailyBudgetUsd?: number;
      desiredClicksPerDay?: number;
      offerContext?: string;
      /** Janela temporal Keyword Ideas (Google). Se `keywordMetricsRange` existir, prevalece. */
      keywordMetricsTimeframe?: "default" | "last_24" | "last_36";
      keywordMetricsRange?: {
        startYear: number;
        startMonth: number;
        endYear: number;
        endMonth: number;
      };
    },
  ) {
    return apiClient.post<{
      ok: true;
      keyword: string;
      country_code: string;
      language_code: string;
      monthly_search_volume: number;
      avg_cpc_usd: number;
      competition: "low" | "medium" | "high";
      competition_label_pt: string;
      analysis_bullets_pt: string[];
      related_keywords: string[];
      user_cpc_verdict_pt: string | null;
      user_cpc_status: "below" | "competitive" | "above" | null;
      data_provenance_pt: string;
      generated_at: string;
      local_cpc_display: { amount: number; suffix: string; disclaimer_pt: string } | null;
      metrics_source: "estimated" | "google_ads";
      cpc_from_google_ads: boolean;
      decision: {
        keyword_score: number;
        score_breakdown_pt: Array<{ text: string; tone: "positive" | "warning" | "neutral" }>;
        decision_status: "recommended" | "caution" | "avoid";
        decision_label_pt: string;
        next_action_pt: string;
        budget_insight_pt: string | null;
      };
      volume_trend: {
        points: Array<{ year: number; month: number; day: number | null; volume: number }>;
        point_source: "google_monthly" | "synthetic_from_average" | "estimated_model";
        disclaimer_pt: string;
      };
    }>(`/paid/projects/${projectId}/google-keyword-insight`, body);
  },

  postGoogleKeywordSuggest(
    projectId: string,
    body: { offer: string; languageCode: string; landingHostname?: string },
  ) {
    return apiClient.post<{ ok: true; suggestions: string[] }>(
      `/paid/projects/${projectId}/google-keyword-suggest`,
      body,
    );
  },

  postGoogleCampaignPlan(
    projectId: string,
    body: {
      landingUrl: string;
      offer: string;
      objective: string;
      dailyBudgetUsd: number;
      geoTargets: string[];
      languageTargets: string[];
      google_bidding_strategy?:
        | "manual_cpc"
        | "maximize_clicks"
        | "maximize_conversions"
        | "target_cpa"
        | "target_roas";
      google_target_cpa_usd?: number;
      google_target_roas?: number;
      /** Lance máximo CPC em USD quando estratégia = `manual_cpc`. Vem do cálculo do UI:
       *  `CPC = orçamento ÷ cliques alvo`. Aplicado como `cpcBidMicros` no AdGroup ao publicar. */
      google_max_cpc_usd?: number;
      optimizer_pause_spend_usd?: number | null;
      optimizer_pause_min_clicks?: number | null;
      /** Sinais reais do produto (todos opcionais). Campos vazios são ignorados; nada é inventado. */
      product_signals?: {
        price?: string;
        price_full?: string;
        discount?: string;
        guarantee?: string;
        shipping?: string;
        bundles?: string[];
        bonuses?: string;
        certifications?: string;
        attributes?: string[];
      };
      campaign_seed_keyword?: string;
      google_search_plan_mode?: "assistant" | "manual";
      /** Obrigatório quando `google_search_plan_mode` = `manual` — mesma forma que a API Google Search (grupos + keywords + RSA). */
      google_manual_search_plan?: {
        campaign: { name: string; objective_summary: string };
        ad_groups: Array<{
          name: string;
          keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
          rsa: { headlines: string[]; descriptions: string[] };
        }>;
      };
    },
  ) {
    return apiClient.post<CampaignPlanAssistantOk>(`/paid/projects/${projectId}/google-campaign-plan`, body);
  },

  snapCampaignGeoTargetsToGuardrail(projectId: string, campaignId: string) {
    return apiClient.post<{ campaign: CampaignRow; adjusted: boolean }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/snap-geo-to-guardrail`,
      {},
    );
  },

  getGoogleCampaignStudio(projectId: string, campaignId: string) {
    return apiClient.get<GoogleCampaignStudioDto>(`/paid/projects/${projectId}/campaigns/${campaignId}/google-studio`);
  },

  postGoogleStudioActions(projectId: string, campaignId: string, body: Record<string, unknown>) {
    return apiClient.post<{ ok: true; change_request: { id: string; status: string } }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/google-studio-actions`,
      body,
    );
  },

  patchGoogleCampaignDraft(projectId: string, campaignId: string, body: Record<string, unknown>) {
    return apiClient.patch<{ ok: true; studio: GoogleCampaignStudioDto }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/google-draft`,
      body,
    );
  },

  snapCampaignDailyBudgetToGuardrail(projectId: string, campaignId: string) {
    return apiClient.post<{ campaign: CampaignRow; adjusted: boolean }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/snap-daily-budget-to-guardrail`,
      {},
    );
  },

  archiveCampaign(projectId: string, campaignId: string) {
    return apiClient.post<{ ok: boolean }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/archive`,
      {},
    );
  },

  /** Remove o registo no Clickora (só campanhas arquivadas). Não apaga na Google/Meta/TikTok. */
  deleteArchivedCampaign(projectId: string, campaignId: string) {
    return apiClient.delete<{ ok: boolean }>(`/paid/projects/${projectId}/campaigns/${campaignId}`);
  },

  /** Remove pedido rejeitado ou falhado da fila (só admin do projecto). */
  deleteChangeRequest(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/paid/change-requests/${id}`);
  },

  patchCampaignOptimizerLimits(
    projectId: string,
    campaignId: string,
    body: { optimizer_pause_spend_usd?: number | null; optimizer_pause_min_clicks?: number | null },
  ) {
    return apiClient.patch<{ campaign: CampaignRow }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/optimizer-limits`,
      body,
    );
  },

  uploadMetaAsset(projectId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.postFormData<{ path: string }>(`/paid/projects/${projectId}/meta-assets`, formData);
  },

  uploadTiktokAsset(projectId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.postFormData<{ path: string }>(`/paid/projects/${projectId}/tiktok-assets`, formData);
  },

  postTiktokCampaignPlan(
    projectId: string,
    body: {
      landingUrl: string;
      offer: string;
      audienceNotes: string;
      objective: "traffic" | "reach" | "video_views" | "leads" | "conversions" | "app_installs";
      dailyBudgetUsd: number;
      geoTargets: string[];
      ageMin: number;
      ageMax: number;
      complianceAcknowledged: boolean;
      videoAssetPath: string | null;
      tiktok_bidding_strategy?: "lowest_cost" | "bid_cap_usd";
      tiktok_bid_amount_usd?: number;
    },
  ) {
    return apiClient.post<CampaignPlanAssistantOk>(`/paid/projects/${projectId}/tiktok-campaign-plan`, body);
  },

  postMetaCampaignPlan(
    projectId: string,
    body: {
      landingUrl: string;
      offer: string;
      audienceNotes: string;
      objective: "traffic" | "leads" | "purchases" | "awareness" | "engagement" | "app_promotion";
      dailyBudgetUsd: number;
      geoTargets: string[];
      placements: string[];
      ageMin: number;
      ageMax: number;
      specialAdCategories: string[];
      complianceAcknowledged: boolean;
      assetPath: string | null;
      meta_bidding_strategy?: "lowest_cost" | "bid_cap_usd" | "cost_cap_usd";
      meta_bid_amount_usd?: number;
    },
  ) {
    return apiClient.post<CampaignPlanAssistantOk>(`/paid/projects/${projectId}/meta-campaign-plan`, body);
  },
};

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

/** Página Facebook gerida pela conta ligada (Graph `me/accounts`). */
export type MetaPageOption = {
  id: string;
  name: string;
  category: string | null;
  can_advertise: boolean;
};

export type GoogleStudioKeywordRow = {
  id: string;
  text: string;
  match_type: string;
  status: string;
  external_criterion_id?: string | null;
};

export type GoogleStudioNegativeKeywordRow = {
  id: string;
  text: string;
  match_type: string;
  external_criterion_id?: string | null;
};

export type GoogleCampaignAssetExtensionsDto = {
  sitelinks: Array<{
    link_text: string;
    final_url: string;
    description1?: string;
    description2?: string;
  }>;
  callouts: string[];
  structured_snippet: { header: string; values: string[] } | null;
};

export type GoogleStudioRsaRow = {
  id: string;
  headlines: string[];
  descriptions: string[];
  final_urls: string[];
  /** Caminhos de visualização (até 15 caracteres cada), como na Google RSA. */
  path1: string | null;
  path2: string | null;
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
  negative_keywords: GoogleStudioNegativeKeywordRow[];
  rsa: GoogleStudioRsaRow[];
};

export type GoogleCampaignStudioDto = {
  campaign: CampaignRow & { objective_summary?: string | null; language_targets?: string[] };
  published: boolean;
  asset_extensions: GoogleCampaignAssetExtensionsDto | null;
  campaign_negative_keywords: GoogleStudioNegativeKeywordRow[];
  ad_groups: GoogleStudioAdGroupRow[];
};

export type GoogleCampaignPerformanceDayRow = {
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

export type GoogleCampaignPerformanceResponse = {
  rows: GoogleCampaignPerformanceDayRow[];
  totals: Omit<GoogleCampaignPerformanceDayRow, "date">;
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

  /** Pré-visualiza próximo rascunho após flag CTR (loop Copilot) + ranking rede. */
  previewCreativeSwap(projectId: string, campaignId: string) {
    return apiClient.get<{
      campaign_id: string;
      platform: string;
      has_flag: boolean;
      flag_reason: string | null;
      next_action:
        | { type: "meta_publish_creative"; creative_id: string; label: string }
        | { type: "publish_rsa"; paid_ads_rsa_id: string; label: string }
        | null;
      detail: string;
      ranking: {
        ranked: Array<{
          id: string;
          label: string;
          impressions: number;
          clicks: number;
          conversions: number;
          ctr: number | null;
          rank: number;
          score: number;
        }>;
        winner_id: string | null;
        loser_id: string | null;
        min_impressions: number;
        note: string;
      } | null;
      ranking_source: "meta_insights" | "google_ads" | "unavailable" | null;
      ranking_error: string | null;
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/creative-swap`);
  },

  applyCreativeSwap(projectId: string, campaignId: string) {
    return apiClient.post<{
      ok: true;
      change_request_id: string;
      change_request_status: string;
      next_action: { type: string; label: string };
      flag_cleared: boolean;
      apply_error?: string;
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/creative-swap/apply`, {});
  },

  dismissCreativeSwap(projectId: string, campaignId: string) {
    return apiClient.post<{ ok: true }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/creative-swap/dismiss`,
      {},
    );
  },

  /** Variantes de mensagem/oferta a partir do copy existente; persist grava rascunhos. */
  recommendMessageOffer(projectId: string, campaignId: string, persist = true) {
    return apiClient.post<{
      ok: true;
      platform: string;
      variants: Array<{ headline: string; body: string; note: string; source: string }>;
      model: string | null;
      llm_error: string | null;
      persisted_ids: string[];
      persist_detail: string | null;
      destination_url: string | null;
      detail: string;
      ai_run_id: string | null;
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/creative-swap/message-recs`, {
      persist,
    });
  },

  /** Saúde do projecto: spend × conversões × decisões (janela do optimizer). */
  getProjectHealthSummary(projectId: string) {
    return apiClient.get<{
      project_id: string;
      project_name: string;
      paid_mode: string;
      lookback_hours: number;
      window: { from: string; to: string };
      totals: {
        campaigns: number;
        clicks: number;
        approved_conversions: number;
        revenue_usd: number;
        spend_usd: number;
        spend_known_campaigns: number;
        spend_unknown_campaigns: number;
        roas: number | null;
        decisions_total_7d: number;
        by_platform?: {
          google_ads: number;
          meta_ads: number;
          tiktok_ads: number;
        };
      };
      decisions_7d: Record<string, number>;
      campaigns: Array<{
        campaign_id: string;
        name: string;
        platform: string;
        status: string;
        clicks: number;
        approved_conversions: number;
        revenue_usd: number;
        spend_usd: number | null;
      }>;
    }>(`/paid/projects/${projectId}/health-summary`);
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

  listMetaPages(projectId: string) {
    return apiClient.get<{ pages: MetaPageOption[]; selected_page_id: string | null }>(
      `/paid/projects/${projectId}/meta-pages`,
    );
  },

  selectMetaPage(projectId: string, body: { pageId: string; pageName?: string }) {
    return apiClient.post<Record<string, unknown>>(`/paid/projects/${projectId}/meta-page`, body);
  },

  googleOAuthStart(projectId: string) {
    return apiClient.post<{ url: string }>("/paid/oauth/google/start", { projectId });
  },

  /** Reutiliza OAuth de Integrações → Google no projecto Ads Studio (sem 2.º consentimento). */
  googleLinkFromIntegrations(projectId: string, opts?: { import_campaigns?: boolean }) {
    return apiClient.post<{
      ok: true;
      linked_from: "integrations";
      customer_id: string;
      account_name: string | null;
      login_customer_id: string | null;
      import: { imported: number; errors: number; remote: number } | null;
    }>("/paid/oauth/google/from-integrations", {
      projectId,
      import_campaigns: opts?.import_campaigns ?? true,
    });
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

  /** Gestor Google Ads — overview / métricas / inventário / recomendações / IA / duplicar */
  getGoogleAdsManagerOverview(
    projectId: string,
    opts?: { preset?: string; from?: string; to?: string },
  ) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString() ? `?${q}` : "";
    return apiClient.get<{
      ok: true;
      connected: boolean;
      connection_error?: string | null;
      connection_error_code?: string | null;
      range: { from: string; to: string };
      counts: Record<string, number>;
      metrics: {
        impressions: number;
        clicks: number;
        cost_micros: number;
        conversions: number;
        conversions_value: number;
        ctr: number;
        average_cpc_micros: number;
        cost_per_conversion_micros: number;
        roas: number;
      } | null;
      source: string;
      account?: { customer_id: string; account_name: string | null };
    }>(`/paid/projects/${projectId}/google-ads/overview${qs}`);
  },

  getGoogleAdsFinalUrlAudit(projectId: string) {
    return apiClient.get<{
      ok: true;
      expected_host: string | null;
      website_url: string | null;
      source: string;
      note: string;
      totals: { campaigns: number; ok: number; warn: number; critical: number };
      campaigns: Array<{
        campaign_id: string;
        campaign_name: string;
        local_status: string;
        external_campaign_id: string | null;
        ads_checked: number;
        sample_url: string | null;
        hosts: string[];
        multiple_distinct_hosts: boolean;
        issues: string[];
        issue_labels: string[];
        severity: "ok" | "warn" | "critical";
      }>;
    }>(`/paid/projects/${projectId}/google-ads/final-url-audit`);
  },

  repairGoogleAdsFinalUrls(projectId: string) {
    return apiClient.post<{
      ok: true;
      repaired_count: number;
      /** Só conta anúncios mutados com sucesso na Google Ads (não só BD local). */
      applied_to_google_count: number;
      skipped_count: number;
      error_count: number;
      repaired: Array<{
        rsa_id: string;
        campaign_name: string;
        before: string | null;
        after: string | null;
        applied_to_google: boolean;
      }>;
      skipped: Array<{ rsa_id: string; campaign_name: string; reason: string }>;
      errors: Array<{ rsa_id: string; campaign_name: string; error: string }>;
      note: string;
    }>(`/paid/projects/${projectId}/google-ads/final-url-repair`, {});
  },

  getGoogleAdsCampaignsMetrics(
    projectId: string,
    opts?: { preset?: string; from?: string; to?: string },
  ) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString() ? `?${q}` : "";
    return apiClient.get<{
      ok: true;
      connected: boolean;
      connection_error: string | null;
      connection_error_code?: string | null;
      account?: { customer_id: string; account_name: string | null } | null;
      range: { from: string; to: string };
      source: string;
      inventory_scope?: "local_drafts" | "google_network";
      campaigns: Array<{
        id: string;
        name: string;
        local_status: string;
        /** ENABLED / PAUSED da Google quando a rede respondeu. */
        google_status?: string | null;
        external_campaign_id: string | null;
        inventory_origin?: "google" | "local_draft";
        daily_budget_micros: number | null;
        bidding_strategy: string | null;
        created_at: string;
        metrics: {
          impressions: number;
          clicks: number;
          cost_micros: number;
          conversions: number;
          conversions_value: number;
          ctr: number;
          average_cpc_micros: number;
          cost_per_conversion_micros: number;
          roas: number;
        } | null;
        metrics_available: boolean;
        budget_shared: boolean;
        budget_reference_count: number;
        budget_editable: boolean;
        tracking_clicks: number;
        google_clicks: number | null;
        click_delta: number | null;
        click_capture_ratio: number | null;
        funnel_risk: boolean;
      }>;
      totals?: {
        funnel_risk: number;
        with_google_clicks: number;
        linked_to_google?: number;
        local_drafts?: number;
      };
    }>(`/paid/projects/${projectId}/google-ads/campaigns-metrics${qs}`);
  },

  getGoogleAdsInventory(projectId: string) {
    return apiClient.get<{
      ok: true;
      ad_groups: Array<Record<string, unknown>>;
      keywords: Array<Record<string, unknown>>;
      ads: Array<Record<string, unknown>>;
      budgets: Array<Record<string, unknown>>;
      negative_keywords: {
        campaign_level: Array<Record<string, unknown>>;
        ad_group_level: Array<Record<string, unknown>>;
      };
      totals: Record<string, number>;
    }>(`/paid/projects/${projectId}/google-ads/inventory`);
  },

  getGoogleAdsRecommendations(projectId: string) {
    return apiClient.get<{
      ok: true;
      customer_id: string;
      recommendations: Array<{
        resource_name: string | null;
        type: string;
        campaign_resource: string | null;
        impact: unknown;
        apply_supported: boolean;
        dismiss_supported?: boolean;
        note: string;
      }>;
      apply_policy: string;
    }>(`/paid/projects/${projectId}/google-ads/recommendations`);
  },

  postGoogleAdsRecommendationAction(
    projectId: string,
    body: { resource_name: string; action: "apply" | "dismiss" },
  ) {
    return apiClient.post<{ ok: true; action: "apply" | "dismiss" }>(
      `/paid/projects/${projectId}/google-ads/recommendations/action`,
      body,
    );
  },

  getGoogleAdsDevicePerformance(
    projectId: string,
    opts?: { preset?: string; from?: string; to?: string; campaign_id?: string },
  ) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    if (opts?.campaign_id) q.set("campaign_id", opts.campaign_id);
    const qs = q.toString() ? `?${q}` : "";
    type DeviceMetrics = {
      impressions: number;
      clicks: number;
      cost_micros: number;
      conversions: number;
      ctr: number;
      average_cpc_micros: number;
      cost_per_conversion_micros: number;
      roas: number;
    };
    return apiClient.get<{
      ok: true;
      range: { from: string; to: string };
      source: string;
      filter_campaign_id: string | null;
      campaigns_scoped: number;
      devices: Array<{ device: string; metrics: DeviceMetrics }>;
      by_campaign: Array<{
        campaign_id: string;
        campaign_name: string;
        external_campaign_id: string;
        device: string;
        metrics: DeviceMetrics;
      }>;
    }>(`/paid/projects/${projectId}/google-ads/device-performance${qs}`);
  },

  postGoogleAdsAiInsights(projectId: string, body: { question: string; preset?: string }) {
    return apiClient.post<{
      ok: true;
      question: string;
      range: { from: string; to: string };
      source: string;
      diagnosis: string;
      evidence: Array<{ label: string; detail: string; campaign_id?: string }>;
      suggestions: Array<{
        action: string;
        risk: string;
        evidence: string;
        campaign_id?: string;
        suggested_op?: "pause_campaign" | "increase_budget_20";
        daily_budget_micros?: number | null;
      }>;
      executes_mutations: boolean;
      note: string;
    }>(`/paid/projects/${projectId}/google-ads/ai-insights`, body);
  },

  duplicateGoogleCampaign(
    projectId: string,
    campaignId: string,
    body?: { name?: string; daily_budget_usd?: number; publish?: boolean },
  ) {
    return apiClient.post<{
      ok: true;
      campaign_id: string;
      name: string;
      status: string;
      published_request_id?: string;
      /** true = Autopilot/apply-now; false = na fila; omitido se não pediu publish */
      published_applied?: boolean;
      warnings: string[];
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/duplicate-google`, body ?? {});
  },

  getGoogleAdsProjectSearchTerms(
    projectId: string,
    opts?: {
      preset?: string;
      from?: string;
      to?: string;
      waste_only?: boolean;
      limit?: number;
      /** UUID local da campanha — filtra na Google, não só no ecrã. */
      campaign_id?: string;
    },
  ) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    if (opts?.waste_only) q.set("waste_only", "1");
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.campaign_id) q.set("campaign_id", opts.campaign_id);
    const qs = q.toString() ? `?${q}` : "";
    return apiClient.get<{
      ok: true;
      connected: boolean;
      connection_error: string | null;
      range: { from: string; to: string };
      filter_campaign_id: string | null;
      campaigns: Array<{ id: string; name: string; external_campaign_id: string }>;
      terms: Array<{
        campaign_id: string;
        campaign_name: string;
        external_campaign_id: string;
        search_term: string;
        status: string | null;
        metrics: {
          impressions: number;
          clicks: number;
          cost_micros: number;
          conversions: number;
          ctr: number;
          average_cpc_micros: number;
          cost_per_conversion_micros: number;
          roas: number;
        };
        already_negative: boolean;
        waste_candidate: boolean;
      }>;
      totals: {
        rows: number;
        waste: number;
        campaigns_with_terms: number;
        published_campaigns: number;
      };
      source: string;
      note: string | null;
    }>(`/paid/projects/${projectId}/google-ads/search-terms${qs}`);
  },

  negateGoogleAdsSearchTermsBatch(
    projectId: string,
    body: {
      match_type?: "exact" | "phrase" | "broad";
      items: Array<{ campaign_id: string; terms: string[] }>;
    },
  ) {
    return apiClient.post<{
      ok: boolean;
      added: number;
      failed: number;
      applied?: number;
      pending?: number;
      results: Array<{
        campaign_id: string;
        ok: boolean;
        added?: number;
        total?: number;
        error?: string;
        change_request_id?: string;
        change_request_status?: string;
      }>;
    }>(`/paid/projects/${projectId}/google-ads/search-terms/negate-batch`, body);
  },

  getGoogleAdsSearchTerms(
    projectId: string,
    campaignId: string,
    opts?: { preset?: string; from?: string; to?: string },
  ) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString() ? `?${q}` : "";
    return apiClient.get<{
      ok: true;
      campaign_id: string;
      campaign_name: string;
      range: { from: string; to: string };
      terms: Array<{
        search_term: string;
        status: string | null;
        metrics: {
          impressions: number;
          clicks: number;
          cost_micros: number;
          conversions: number;
          ctr: number;
          average_cpc_micros: number;
          cost_per_conversion_micros: number;
          roas: number;
        };
        already_negative: boolean;
        waste_candidate: boolean;
      }>;
      source: string;
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/google-ads/search-terms${qs}`);
  },

  negateGoogleAdsSearchTerms(
    projectId: string,
    campaignId: string,
    terms: Array<{ text: string; match_type?: "exact" | "phrase" | "broad" }>,
  ) {
    return apiClient.post<{
      ok: true;
      added: number;
      total: number;
      already_present?: boolean;
      change_request?: { id: string; status: string };
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/google-ads/search-terms/negate`, { terms });
  },

  listRemoteGoogleCampaigns(projectId: string) {
    return apiClient.get<{
      ok: true;
      customer_id: string;
      account_name: string | null;
      campaigns: Array<{
        external_campaign_id: string;
        name: string;
        status: string;
        channel_type: string;
        daily_budget_micros: number | null;
        budget_shared: boolean;
        budget_reference_count: number;
        budget_editable: boolean;
        already_imported: boolean;
        local_campaign_id: string | null;
      }>;
      totals: { remote: number; imported: number; new: number };
    }>(`/paid/projects/${projectId}/google-ads/remote-campaigns`);
  },

  importGoogleCampaigns(
    projectId: string,
    body: { external_campaign_ids: string[]; refresh_existing?: boolean },
  ) {
    return apiClient.post<{
      ok: true;
      imported: Array<{
        campaign_id: string;
        external_campaign_id: string;
        created: boolean;
        name: string;
        status: string;
        counts: Record<string, number>;
      }>;
      errors: Array<{ external_campaign_id: string; error: string }>;
    }>(`/paid/projects/${projectId}/google-ads/import-campaigns`, body);
  },

  getGoogleRsaPolicy(projectId: string, campaignId: string) {
    return apiClient.get<{
      ok: true;
      campaign_id: string;
      campaign_name: string;
      ads: Array<{
        external_ad_id: string;
        status: string | null;
        approval_status: string | null;
        review_status: string | null;
        policy_topics: string[];
        disapproved: boolean;
      }>;
      disapproved_count: number;
    }>(`/paid/projects/${projectId}/campaigns/${campaignId}/google-ads/rsa-policy`);
  },

  getGoogleAdsRsaPolicyAudit(projectId: string) {
    return apiClient.get<{
      ok: true;
      connected: boolean;
      source: string;
      note: string | null;
      totals: {
        campaigns: number;
        disapproved_ads: number;
        limited_ads: number;
        critical_campaigns: number;
      };
      campaigns: Array<{
        campaign_id: string;
        campaign_name: string;
        local_status: string;
        external_campaign_id: string;
        ads_checked: number;
        disapproved_count: number;
        limited_count: number;
        topics: string[];
        severity: "ok" | "warn" | "critical";
      }>;
    }>(`/paid/projects/${projectId}/google-ads/rsa-policy-audit`);
  },

  getGoogleAdsKeywordMetrics(
    projectId: string,
    opts?: { preset?: string; from?: string; to?: string; campaign_id?: string },
  ) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    if (opts?.campaign_id) q.set("campaign_id", opts.campaign_id);
    const qs = q.toString() ? `?${q}` : "";
    return apiClient.get<{
      ok: true;
      connected: boolean;
      connection_error: string | null;
      range: { from: string; to: string };
      source: string;
      keywords: Array<{
        id: string;
        text: string;
        match_type: string;
        status: string;
        campaign_id: string;
        campaign_name: string;
        ad_group_id: string;
        ad_group_name: string;
        external_criterion_id: string | null;
        metrics: {
          impressions: number;
          clicks: number;
          cost_micros: number;
          conversions: number;
          ctr: number;
          average_cpc_micros: number;
          cost_per_conversion_micros: number;
          roas: number;
        } | null;
      }>;
    }>(`/paid/projects/${projectId}/google-ads/keyword-metrics${qs}`);
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

  getGoogleCampaignPerformance(projectId: string, campaignId: string, from: string, to: string) {
    const qs = `?from=${encodeURIComponent(from.trim().slice(0, 10))}&to=${encodeURIComponent(to.trim().slice(0, 10))}`;
    return apiClient.get<GoogleCampaignPerformanceResponse>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/google-performance${qs}`,
    );
  },

  postGoogleStudioActions(projectId: string, campaignId: string, body: Record<string, unknown>) {
    return apiClient.post<{ ok: true; change_request: { id: string; status: string } }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/google-studio-actions`,
      body,
    );
  },

  postMetaStudioActions(projectId: string, campaignId: string, body: Record<string, unknown>) {
    return apiClient.post<{ ok: true; change_request: { id: string; status: string } }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/meta-studio-actions`,
      body,
    );
  },

  postTiktokStudioActions(projectId: string, campaignId: string, body: Record<string, unknown>) {
    return apiClient.post<{ ok: true; change_request: { id: string; status: string } }>(
      `/paid/projects/${projectId}/campaigns/${campaignId}/tiktok-studio-actions`,
      body,
    );
  },

  getNetworksReadiness(projectId: string) {
    return apiClient.get<{
      ok: true;
      google: {
        connected: boolean;
        campaigns: number;
        linked: number;
        live: number;
        manager_ready: boolean;
      };
      meta: {
        connected: boolean;
        campaigns: number;
        linked: number;
        live: number;
        missing_landing: number;
        manager_ready: boolean;
      };
      tiktok: {
        connected: boolean;
        campaigns: number;
        linked: number;
        live: number;
        with_ad: number;
        missing_ad: number;
        missing_landing: number;
        manager_ready: boolean;
      };
      optimizer: {
        enabled: boolean;
        dry_run: boolean;
        rules_phase: string;
        covers: string[];
        note: string;
      };
      score: { value: number };
    }>(`/paid/projects/${projectId}/networks-readiness`);
  },

  getMetaAdsOverview(projectId: string, opts?: { preset?: string; from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString();
    return apiClient.get<{
      ok: true;
      connected: boolean;
      range: { from: string; to: string };
      counts: Record<string, number>;
      metrics: {
        impressions: number;
        clicks: number;
        cost_micros: number;
        conversions: number;
        conversions_value?: number;
        ctr: number;
        average_cpc_micros: number;
        roas: number;
      } | null;
      source: string;
      connection_error?: string;
    }>(`/paid/projects/${projectId}/meta-ads/overview${qs ? `?${qs}` : ""}`);
  },

  getMetaAdsCampaignsMetrics(projectId: string, opts?: { preset?: string; from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString();
    return apiClient.get<{
      ok: true;
      connected: boolean;
      range: { from: string; to: string };
      network_error: string | null;
      campaigns: Array<{
        id: string;
        name: string;
        status: string;
        external_campaign_id: string | null;
        daily_budget_micros: number | null;
        metrics: {
          impressions: number;
          clicks: number;
          cost_micros: number;
          conversions: number;
          ctr: number;
          roas: number;
        } | null;
      }>;
    }>(`/paid/projects/${projectId}/meta-ads/campaigns-metrics${qs ? `?${qs}` : ""}`);
  },

  getMetaAdsInventory(projectId: string) {
    return apiClient.get<{
      ok: true;
      campaigns: Array<{
        id: string;
        name: string;
        status: string;
        external_campaign_id: string | null;
        adsets_count: number;
        landing_url: string | null;
      }>;
      adsets: Array<{
        id: string;
        campaign_id: string;
        campaign_name: string;
        name: string;
        status: string;
        external_id: string | null;
        daily_budget_cents: number | null;
        creatives_count: number;
        ads_count: number;
      }>;
      totals: {
        campaigns: number;
        adsets: number;
        creatives: number;
        ads: number;
        linked: number;
      };
    }>(`/paid/projects/${projectId}/meta-ads/inventory`);
  },

  listRemoteMetaCampaigns(projectId: string) {
    return apiClient.get<{
      ok: true;
      campaigns: Array<{
        external_campaign_id: string;
        name: string;
        status: string;
        objective: string | null;
        daily_budget_cents: number | null;
        budget_editable: boolean;
        already_imported: boolean;
        local_campaign_id: string | null;
      }>;
      totals: { remote: number; imported: number; new: number };
    }>(`/paid/projects/${projectId}/meta-ads/remote-campaigns`);
  },

  importMetaCampaigns(
    projectId: string,
    body: { external_campaign_ids: string[]; refresh_existing?: boolean; landing_url?: string | null },
  ) {
    return apiClient.post<{
      ok: true;
      imported: Array<{ local_campaign_id: string; external_campaign_id: string; created: boolean }>;
      skipped: Array<{ external_campaign_id: string; reason: string }>;
      landing_url_stored: boolean;
      note: string;
    }>(`/paid/projects/${projectId}/meta-ads/import-campaigns`, body);
  },

  getTiktokAdsOverview(projectId: string, opts?: { preset?: string; from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString();
    return apiClient.get<{
      ok: true;
      connected: boolean;
      range: { from: string; to: string };
      counts: Record<string, number>;
      metrics: {
        impressions: number;
        clicks: number;
        cost_micros: number;
        conversions: number;
        conversions_value?: number;
        ctr: number;
        average_cpc_micros: number;
        roas: number;
      } | null;
      source: string;
      connection_error?: string;
    }>(`/paid/projects/${projectId}/tiktok-ads/overview${qs ? `?${qs}` : ""}`);
  },

  getTiktokAdsCampaignsMetrics(projectId: string, opts?: { preset?: string; from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (opts?.preset) q.set("preset", opts.preset);
    if (opts?.from) q.set("from", opts.from);
    if (opts?.to) q.set("to", opts.to);
    const qs = q.toString();
    return apiClient.get<{
      ok: true;
      connected: boolean;
      range: { from: string; to: string };
      network_error: string | null;
      campaigns: Array<{
        id: string;
        name: string;
        status: string;
        external_campaign_id: string | null;
        daily_budget_micros: number | null;
        metrics: {
          impressions: number;
          clicks: number;
          cost_micros: number;
          conversions: number;
          ctr: number;
          roas: number;
        } | null;
      }>;
    }>(`/paid/projects/${projectId}/tiktok-ads/campaigns-metrics${qs ? `?${qs}` : ""}`);
  },

  getTiktokAdsInventory(projectId: string) {
    return apiClient.get<{
      ok: true;
      campaigns: Array<{
        id: string;
        name: string;
        status: string;
        external_campaign_id: string | null;
        tiktok_ad_group_id: string | null;
        tiktok_ad_id: string | null;
        daily_budget_micros: number | null;
        landing_url: string | null;
      }>;
      totals: {
        campaigns: number;
        linked: number;
        with_ad_group: number;
        with_ad: number;
      };
    }>(`/paid/projects/${projectId}/tiktok-ads/inventory`);
  },

  listRemoteTiktokCampaigns(projectId: string) {
    return apiClient.get<{
      ok: true;
      campaigns: Array<{
        external_campaign_id: string;
        name: string;
        status: string;
        objective: string | null;
        daily_budget_micros: number | null;
        budget_editable: boolean;
        already_imported: boolean;
        local_campaign_id: string | null;
      }>;
      totals: { remote: number; imported: number; new: number };
    }>(`/paid/projects/${projectId}/tiktok-ads/remote-campaigns`);
  },

  importTiktokCampaigns(
    projectId: string,
    body: { external_campaign_ids: string[]; refresh_existing?: boolean; landing_url?: string | null },
  ) {
    return apiClient.post<{
      ok: true;
      imported: Array<{ local_campaign_id: string; external_campaign_id: string; created: boolean }>;
      skipped: Array<{ external_campaign_id: string; reason: string }>;
      landing_url_stored: boolean;
      note: string;
    }>(`/paid/projects/${projectId}/tiktok-ads/import-campaigns`, body);
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
      pageId: string;
      meta_bidding_strategy?: "lowest_cost" | "bid_cap_usd" | "cost_cap_usd";
      meta_bid_amount_usd?: number;
    },
  ) {
    return apiClient.post<CampaignPlanAssistantOk>(`/paid/projects/${projectId}/meta-campaign-plan`, body);
  },
};

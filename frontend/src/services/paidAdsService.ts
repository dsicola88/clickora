import { apiClient } from "@/lib/apiClient";

export type PaidAdsProjectRow = { id: string; name: string; createdAt: string };

export type PaidOverviewDto = {
  project: { paid_mode: string };
  connection: Record<string, unknown>;
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
};

export type ChangeRequestRow = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  error_message: string | null;
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

  listCampaigns(projectId: string, platform?: "google_ads" | "meta_ads" | "tiktok_ads") {
    const q = platform ? `?platform=${encodeURIComponent(platform)}` : "";
    return apiClient.get<{ campaigns: CampaignRow[] }>(`/paid/projects/${projectId}/campaigns${q}`);
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
  }) {
    return apiClient.post<Record<string, unknown>>("/paid/guardrails", body);
  },
};

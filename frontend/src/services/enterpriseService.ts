import { apiClient } from "@/lib/apiClient";

export type MfaStatus = { mfa_enabled: boolean };

export type MfaSetupStart = {
  secret: string;
  otpauth_url: string;
};

export type MfaSetupConfirm = {
  mfa_enabled: true;
  backup_codes: string[];
  warning: string;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
};

export type ApiKeyCreated = ApiKeyRow & {
  api_key: string;
  warning: string;
};

export type TenantBranding = {
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hide_powered_by: boolean;
  updated_at: string | null;
};

export type OnboardingStep = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  optional?: boolean;
};

export type OnboardingStatus = {
  complete: boolean;
  progress: { done: number; total: number };
  steps: OnboardingStep[];
  plan_name: string | null;
};

export const enterpriseService = {
  async getMfaStatus() {
    return apiClient.get<MfaStatus>("/enterprise/mfa/status");
  },

  async setupMfa() {
    return apiClient.post<MfaSetupStart>("/enterprise/mfa/setup");
  },

  async confirmMfa(code: string) {
    return apiClient.post<MfaSetupConfirm>("/enterprise/mfa/confirm", { code });
  },

  async disableMfa(code: string, password: string) {
    return apiClient.post<{ mfa_enabled: false }>("/enterprise/mfa/disable", { code, password });
  },

  async listApiKeys() {
    return apiClient.get<ApiKeyRow[]>("/enterprise/api-keys");
  },

  async createApiKey(name: string, scopes?: Array<"read" | "write">) {
    return apiClient.post<ApiKeyCreated>("/enterprise/api-keys", {
      name,
      ...(scopes ? { scopes } : {}),
    });
  },

  async revokeApiKey(id: string) {
    return apiClient.delete<{ ok?: boolean }>(`/enterprise/api-keys/${id}`);
  },

  async getTenantBranding() {
    return apiClient.get<TenantBranding>("/enterprise/branding/tenant");
  },

  async updateTenantBranding(
    body: Partial<{
      brand_name: string | null;
      logo_url: string | null;
      favicon_url: string | null;
      primary_color: string | null;
      accent_color: string | null;
      hide_powered_by: boolean;
    }>,
  ) {
    return apiClient.put<TenantBranding>("/enterprise/branding/tenant", body);
  },

  async getOnboardingStatus() {
    return apiClient.get<OnboardingStatus>("/enterprise/onboarding/status");
  },
};

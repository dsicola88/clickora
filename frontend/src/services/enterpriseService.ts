import { apiClient } from "@/lib/apiClient";

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

export type TenantBranding = {
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hide_powered_by: boolean;
  updated_at?: string | null;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: unknown;
  last_used_at: string | null;
  created_at: string;
};

export const enterpriseService = {
  onboardingStatus() {
    return apiClient.get<OnboardingStatus>("/enterprise/onboarding/status");
  },
  mfaStatus() {
    return apiClient.get<{ mfa_enabled: boolean }>("/enterprise/mfa/status");
  },
  mfaSetup() {
    return apiClient.post<{ secret: string; otpauth_url: string }>("/enterprise/mfa/setup", {});
  },
  mfaConfirm(code: string) {
    return apiClient.post<{ mfa_enabled: boolean; backup_codes: string[]; warning: string }>(
      "/enterprise/mfa/confirm",
      { code },
    );
  },
  mfaDisable(password: string, code: string) {
    return apiClient.post<{ mfa_enabled: boolean }>("/enterprise/mfa/disable", { password, code });
  },
  listApiKeys() {
    return apiClient.get<ApiKeyRow[]>("/enterprise/api-keys");
  },
  createApiKey(name: string) {
    return apiClient.post<{ id: string; api_key: string; warning: string; name: string }>(
      "/enterprise/api-keys",
      { name },
    );
  },
  revokeApiKey(id: string) {
    return apiClient.delete(`/enterprise/api-keys/${id}`);
  },
  getTenantBranding() {
    return apiClient.get<TenantBranding>("/enterprise/branding/tenant");
  },
  putTenantBranding(body: Partial<TenantBranding>) {
    return apiClient.put<TenantBranding>("/enterprise/branding/tenant", body);
  },
};

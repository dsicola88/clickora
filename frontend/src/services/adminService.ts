import { apiClient } from "@/lib/apiClient";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import type { AdminOverview, AdminPlanRow, AdminUser, PlansLandingPublic } from "@/types/api";

export const adminService = {
  async getAllUsers() {
    return apiClient.get<AdminUser[]>("/admin/users");
  },

  async suspendUser(userId: string) {
    return apiClient.post(`/admin/users/${userId}/suspend`);
  },

  async reactivateUser(userId: string) {
    return apiClient.post(`/admin/users/${userId}/reactivate`);
  },

  async getMetrics() {
    return apiClient.get<{
      total_users: number;
      active_users: number;
      total_presells: number;
      total_events: number;
    }>("/admin/metrics");
  },

  async getOverview() {
    return apiClient.get<AdminOverview>("/admin/overview");
  },

  async getPlans() {
    return apiClient.get<AdminPlanRow[]>("/admin/plans");
  },

  async updateUserPlan(userId: string, planType: string) {
    return apiClient.patch(`/admin/users/${userId}/plan`, { plan_type: planType });
  },

  async updateUserSubscription(userId: string, body: { starts_at: string; ends_at: string | null }) {
    return apiClient.patch<{ message: string }>(`/admin/users/${userId}/subscription`, body);
  },

  async setUserPassword(userId: string, new_password: string) {
    return apiClient.post<{ message: string }>(`/admin/users/${userId}/password`, { new_password });
  },

  async updatePlan(
    planId: string,
    body: {
      name?: string;
      price_cents?: number;
      max_presell_pages?: number | null;
      max_clicks_per_month?: number | null;
      max_custom_domains?: number;
      has_branding?: boolean;
      affiliate_webhook_enabled?: boolean;
      dpilot_ads_enabled?: boolean;
      features?: string[];
      cta_label?: string | null;
    },
  ) {
    return apiClient.patch<{ message: string }>(`/admin/plans/${planId}`, body);
  },

  async uploadFavicon(file: File) {
    const form = new FormData();
    form.append("favicon", file);
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/branding/favicon`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      return { data: body, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },

  async clearFavicon() {
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/branding/favicon`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      return { data: body, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },

  async getPlansLanding() {
    return apiClient.get<PlansLandingPublic>("/admin/plans-landing");
  },

  async patchPlansLanding(body: {
    badge_text?: string | null;
    hero_title?: string;
    hero_subtitle?: string | null;
    intro_text?: string | null;
    footer_text?: string | null;
    hero_font?: string;
    hero_text_align?: string;
    hero_title_size?: string;
    hero_title_weight?: string;
    hero_subtitle_size?: string;
    intro_font?: string;
    intro_text_align?: string;
    intro_text_size?: string;
    footer_font?: string;
    footer_text_align?: string;
    footer_text_size?: string;
    plan_display_labels?: Record<string, string>;
    hero_visual?: Record<string, unknown>;
    landing_extras?: Record<string, unknown>;
  }) {
    return apiClient.patch<PlansLandingPublic & { ok?: boolean }>("/admin/plans-landing", body);
  },

  async uploadPlansHeroImage(file: File) {
    const form = new FormData();
    form.append("hero_image", file);
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/plans-landing/hero-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        has_hero_image?: boolean;
        updated_at?: string;
      };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      return { data: body, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },

  async uploadPlansGalleryImage(file: File) {
    const form = new FormData();
    form.append("gallery_image", file);
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/plans-landing/gallery-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        image_url?: string;
        filename?: string;
      };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      if (!body.image_url) {
        return { data: null, error: "Resposta sem image_url" };
      }
      return { data: { image_url: body.image_url, filename: body.filename }, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },

  async clearPlansHeroImage() {
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/plans-landing/hero-image`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
      });
      const body = (await res.json().catch(() => ({}))) as PlansLandingPublic & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      return { data: body, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },
};

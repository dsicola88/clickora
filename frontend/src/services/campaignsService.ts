import { apiClient } from "@/lib/apiClient";

export type CampaignStats = {
  clicks: number;
  conversions: number;
  revenue: number;
  conversion_rate: number;
  epc: number | null;
  cpa: number | null;
  roas: number | null;
  profit: number | null;
  spend_note?: "manual_period_estimate";
};

export type AffiliateCampaign = {
  id: string;
  name: string;
  traffic_source: string;
  country: string | null;
  language: string | null;
  offer_url: string | null;
  platform: string | null;
  presell_id: string | null;
  status: string;
  spend_amount: number | null;
  spend_currency: string;
  created_at: string;
  updated_at: string;
  presell: { id: string; title: string; status: string; slug: string } | null;
  stats?: CampaignStats;
};

export type AffiliateCampaignInput = {
  name: string;
  traffic_source: string;
  country?: string | null;
  language?: string | null;
  offer_url?: string | null;
  platform?: string | null;
  presell_id?: string | null;
  status?: "draft" | "active" | "paused";
  spend_amount?: number | null;
  spend_currency?: string | null;
};

export const campaignsService = {
  list(params?: { with_stats?: boolean; from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (params?.with_stats) q.set("with_stats", "1");
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiClient.get<AffiliateCampaign[]>(`/campaigns${qs ? `?${qs}` : ""}`);
  },
  getById(id: string, params?: { from?: string; to?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiClient.get<AffiliateCampaign>(`/campaigns/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
  },
  create(data: AffiliateCampaignInput) {
    return apiClient.post<AffiliateCampaign>("/campaigns", data);
  },
  update(id: string, data: Partial<AffiliateCampaignInput>) {
    return apiClient.patch<AffiliateCampaign>(`/campaigns/${encodeURIComponent(id)}`, data);
  },
  remove(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/campaigns/${encodeURIComponent(id)}`);
  },
};

/** Slug curto para utm_campaign a partir do nome. */
export function campaignUtmSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "campanha";
}

/**
 * URL para colar no anúncio: UTMs + macros da rede.
 * - `utm_campaign` = nome da campanha (slug)
 * - Google/Bing: `utm_term={keyword}` (a rede substitui no clique)
 * - Google: `utm_content={creative}`, `gclid={gclid}` — macros NÃO podem ir encodeadas (%7B…%7D)
 */
export function buildTrackedPresellUrl(basePresellUrl: string, campaignName: string, trafficSource: string): string {
  try {
    const u = new URL(basePresellUrl);
    const slug = campaignUtmSlug(campaignName);
    const src = trafficSource.toLowerCase();
    const isGoogle = src.includes("google");
    const isBing = src.includes("bing") || src.includes("microsoft");

    const overrides: Record<string, string> = {};
    if (!u.searchParams.has("utm_source")) {
      overrides.utm_source = src.replace(/\s+/g, "_") || "ads";
    }
    if (!u.searchParams.has("utm_medium")) overrides.utm_medium = "cpc";
    // Sempre o nome da campanha (slug) — identifica campanha nos Relatórios.
    overrides.utm_campaign = slug;
    if ((isGoogle || isBing) && !u.searchParams.has("utm_term")) {
      overrides.utm_term = "{keyword}";
    }
    if (isGoogle && !u.searchParams.has("utm_content")) {
      overrides.utm_content = "{creative}";
    }
    if (isGoogle && !u.searchParams.has("gclid")) {
      overrides.gclid = "{gclid}";
    }
    if (isBing && !u.searchParams.has("msclkid")) {
      overrides.msclkid = "{msclkid}";
    }
    if ((src.includes("meta") || src.includes("facebook")) && !u.searchParams.has("fbclid")) {
      overrides.fbclid = "{fbclid}";
    }
    if (src.includes("tiktok") && !u.searchParams.has("ttclid")) {
      overrides.ttclid = "{ttclid}";
    }

    const encVal = (v: string) => (v.includes("{") ? v : encodeURIComponent(v));
    const parts: string[] = [];
    u.searchParams.forEach((v, k) => {
      if (Object.prototype.hasOwnProperty.call(overrides, k)) return;
      parts.push(`${encodeURIComponent(k)}=${encVal(v)}`);
    });
    for (const [k, v] of Object.entries(overrides)) {
      parts.push(`${encodeURIComponent(k)}=${encVal(v)}`);
    }
    u.search = parts.length ? `?${parts.join("&")}` : "";
    return u.toString();
  } catch {
    return basePresellUrl;
  }
}

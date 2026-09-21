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

export function buildTrackedPresellUrl(basePresellUrl: string, campaignName: string, trafficSource: string): string {
  try {
    const u = new URL(basePresellUrl);
    const slug = campaignUtmSlug(campaignName);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", trafficSource.toLowerCase().replace(/\s+/g, "_") || "ads");
    }
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "cpc");
    if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", slug);
    const src = trafficSource.toLowerCase();
    if (src.includes("google") && !u.searchParams.has("gclid")) {
      u.searchParams.set("gclid", "{gclid}");
    }
    if ((src.includes("meta") || src.includes("facebook")) && !u.searchParams.has("fbclid")) {
      u.searchParams.set("fbclid", "{fbclid}");
    }
    if (src.includes("tiktok") && !u.searchParams.has("ttclid")) {
      u.searchParams.set("ttclid", "{ttclid}");
    }
    return u.toString();
  } catch {
    return basePresellUrl;
  }
}

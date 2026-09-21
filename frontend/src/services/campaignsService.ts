import { apiClient } from "@/lib/apiClient";

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
  created_at: string;
  updated_at: string;
  presell: { id: string; title: string; status: string; slug: string } | null;
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
};

export const campaignsService = {
  list() {
    return apiClient.get<AffiliateCampaign[]>("/campaigns");
  },
  getById(id: string) {
    return apiClient.get<AffiliateCampaign>(`/campaigns/${encodeURIComponent(id)}`);
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

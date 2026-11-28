import { apiClient } from "@/lib/apiClient";
import {
  buildGoogleAdsPresellUrlParts,
  campaignUtmSlug,
  type GoogleAdsPresellUrlParts,
} from "@/lib/googleAdsPresellUrl";

export type CampaignStats = {
  clicks: number;
  conversions: number;
  revenue: number;
  conversion_rate: number;
  epc: number | null;
  cpa: number | null;
  roas: number | null;
  profit: number | null;
  spend_note?: "lifetime_memo" | "manual_period_estimate";
};

import type { OfferSummaryDto } from "@/types/api";

export type AffiliateCampaign = {
  id: string;
  name: string;
  traffic_source: string;
  country: string | null;
  language: string | null;
  offer_url: string | null;
  platform: string | null;
  presell_id: string | null;
  offer_id?: string | null;
  status: string;
  spend_amount: number | null;
  spend_currency: string;
  created_at: string;
  updated_at: string;
  presell: {
    id: string;
    title: string;
    status: string;
    slug: string;
    custom_domain_id?: string | null;
  } | null;
  offer?: OfferSummaryDto | null;
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
  offer_id?: string | null;
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

export { campaignUtmSlug, buildGoogleAdsPresellUrlParts, type GoogleAdsPresellUrlParts };

/** Lander + UTMs numa string — colar no campo URL final do Google (modo único, como pré-21/11). */
export function buildTrackedPresellUrl(basePresellUrl: string, campaignName: string, trafficSource: string): string {
  const p = buildGoogleAdsPresellUrlParts(basePresellUrl, campaignName, trafficSource);
  return p.finalUrlSuffix ? p.combinedTrackingUrl : p.finalUrl;
}
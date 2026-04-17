import { apiClient } from "@/lib/apiClient";

export interface TrackClickPayload {
  presell_id: string;
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  gclid?: string;
  fbclid?: string;
  /** Cookie Meta _fbp (opcional). */
  fbp?: string;
  ttclid?: string;
  utm_term?: string;
  utm_content?: string;
  msclkid?: string;
}

export interface TrackImpressionPayload {
  presell_id: string;
  referrer?: string;
}

export const trackingService = {
  async trackClick(payload: TrackClickPayload) {
    return apiClient.post("/track/click", payload);
  },

  async trackImpression(payload: TrackImpressionPayload) {
    return apiClient.post("/track/impression", payload);
  },

  async trackEvent(payload: {
    presell_id: string;
    event_type: "click" | "impression" | "conversion" | "lead" | "sale" | "pageview";
    value?: number;
    currency?: string;
    transaction_id?: string;
    gclid?: string;
    fbclid?: string;
    ttclid?: string;
    msclkid?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    metadata?: Record<string, unknown>;
  }) {
    return apiClient.post("/track/event", payload);
  },

  async postbackGoogleAds(payload: {
    presell_id?: string;
    presell_slug?: string;
    gclid: string;
    conversion_name?: string;
    value?: number;
    currency?: string;
    transaction_id?: string;
    source?: string;
    medium?: string;
    campaign?: string;
  }, token?: string) {
    return apiClient.post("/track/postback/google-ads", payload, token ? { "x-postback-token": token } : undefined);
  },

  async postbackMicrosoftAds(payload: {
    presell_id?: string;
    presell_slug?: string;
    msclkid: string;
    conversion_name?: string;
    value?: number;
    currency?: string;
    transaction_id?: string;
    source?: string;
    medium?: string;
    campaign?: string;
  }, token?: string) {
    return apiClient.post("/track/postback/microsoft-ads", payload, token ? { "x-postback-token": token } : undefined);
  },

  async getPostbackTemplates() {
    return apiClient.get<{
      token: string;
      endpoints: { google_ads: string; microsoft_ads: string };
      examples: Record<string, unknown>;
    }>("/track/postbacks/templates");
  },

  async getPostbackAudit(limit = 20, platform?: "google_ads" | "microsoft_ads") {
    const query = new URLSearchParams();
    query.set("limit", String(limit));
    if (platform) query.set("platform", platform);
    return apiClient.get<Array<{
      id: string;
      platform: string;
      status: string;
      message?: string | null;
      created_at: string;
      presell_id?: string | null;
    }>>(`/track/postbacks/audit?${query.toString()}`);
  },

  async lookupGclid(gclid: string) {
    return apiClient.get<{
      id: string;
      campaign?: string | null;
      source?: string | null;
      medium?: string | null;
      created_at: string;
      gclid: string;
      utm_term?: string | null;
      utm_content?: string | null;
    }>(`/track/gclid/${encodeURIComponent(gclid)}`);
  },

  /** GeoLite2: cidade, país, timezone (IP público com entrada na base). */
  async lookupIp(ip: string) {
    return apiClient.get<{
      ok: boolean;
      ip: string;
      found: boolean;
      message?: string;
      geo?: {
        country_code: string;
        region: string;
        city: string;
        timezone: string;
        latitude: number | null;
        longitude: number | null;
        eu: boolean;
        metro: number;
        area_km: number;
      };
    }>(`/track/tools/ip-lookup?q=${encodeURIComponent(ip.trim())}`);
  },
};

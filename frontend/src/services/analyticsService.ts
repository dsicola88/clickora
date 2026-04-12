import { apiClient } from "@/lib/apiClient";
import type { AnalyticsSummary, TrackingEvent } from "@/types/api";

export const analyticsService = {
  async getSummary(params?: { from?: string; to?: string; presell_id?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.presell_id) query.set("presell_id", params.presell_id);
    const qs = query.toString();
    return apiClient.get<AnalyticsSummary[]>(`/analytics${qs ? `?${qs}` : ""}`);
  },

  async getBlacklistBlocks(params?: { limit?: number }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiClient.get<
      Array<{
        id: string;
        created_at: string;
        message: string | null;
        presell_id: string | null;
        ip: string | null;
        channel: string | null;
        user_agent: string | null;
      }>
    >(`/analytics/blacklist-blocks${qs ? `?${qs}` : ""}`);
  },

  async getEvents(params?: {
    event_type?: string;
    presell_id?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.event_type) query.set("event_type", params.event_type);
    if (params?.presell_id) query.set("presell_id", params.presell_id);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiClient.get<TrackingEvent[]>(`/analytics/events${qs ? `?${qs}` : ""}`);
  },

  async getConversions(params?: {
    from?: string;
    to?: string;
    missing_gclid?: boolean;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.missing_gclid) query.set("missing_gclid", "1");
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiClient.get<
      Array<{
        id: string;
        created_at: string;
        click_id: string;
        presell_id: string;
        keyword: string;
        commission: number | null;
        currency: string;
        platform: string;
        google_ads_sync: string | null;
        has_gclid: boolean;
        gclid: string | null;
      }>
    >(`/analytics/conversions${qs ? `?${qs}` : ""}`);
  },

  async getDashboard(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return apiClient.get<{
      total_clicks: number;
      total_impressions: number;
      total_conversions: number;
      ctr: number;
      revenue: number;
      /** Vendas aprovadas (postbacks / tabela conversions). */
      approved_sales_count?: number;
      /** Plataformas distintas em metadata com pelo menos uma venda. */
      affiliate_platforms_count?: number;
      chart_data: Array<{ date: string; clicks: number; impressions: number }>;
      period?: { from: string; to: string };
      tracking_install?: {
        user_id: string;
        embed_js_url: string;
        csv_upload_url: string;
        affiliate_webhook_path?: string;
        google_ads_postback_path?: string;
      };
      tracking_pipeline?: {
        click_tracking: boolean;
        campaign_tracking: boolean;
        sale_tracking: boolean;
        google_ads_integration: boolean;
        google_ads_api_env_configured: boolean;
        google_ads_metrics_available?: boolean;
      };
      google_ads_metrics?: {
        impressions: number;
        clicks: number;
        conversions: number;
        cost_micros: number;
      } | null;
      google_ads_metrics_error?: string | null;
      clicks_by_country?: Array<{ country_code: string | null; clicks: number }>;
    }>(`/analytics/dashboard${qs ? `?${qs}` : ""}`);
  },
};

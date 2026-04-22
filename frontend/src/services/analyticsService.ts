import { apiClient } from "@/lib/apiClient";
import type { AnalyticsSummary, TrackingEvent } from "@/types/api";

/** Resposta 503 de insights com `code` (plataforma vs. passos do utilizador). */
export class GoogleAdsInsightsRequestError extends Error {
  readonly errorCode: string | null;
  constructor(message: string, errorCode: string | null = null) {
    super(message);
    this.name = "GoogleAdsInsightsRequestError";
    this.errorCode = errorCode;
  }
}

export type GoogleAdsInsightsKeywordRow = {
  campaign: string;
  ad_group: string;
  keyword: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
};

export type GoogleAdsInsightsSearchTermRow = {
  campaign: string;
  ad_group: string;
  search_term: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
};

export type GoogleAdsInsightsDemoRow = {
  campaign: string;
  ad_group: string;
  segment_label: string;
  impressions: number;
  clicks: number;
};

export type GoogleAdsInsightsBundle = {
  period: { from: string; to: string };
  synced_at: string;
  keywords: { ok: true; rows: GoogleAdsInsightsKeywordRow[] } | { ok: false; error: string };
  search_terms: { ok: true; rows: GoogleAdsInsightsSearchTermRow[] } | { ok: false; error: string };
  demographics:
    | { ok: true; gender: GoogleAdsInsightsDemoRow[]; age: GoogleAdsInsightsDemoRow[] }
    | { ok: false; error: string };
};

const CSV_MAX_PAGES = 500;

function stripUtf8Bom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/** Junta vários CSV com o mesmo cabeçalho; a partir do 2.º ficheiro remove BOM e linha de cabeçalho. */
async function mergeCsvBlobs(chunks: Blob[]): Promise<Blob> {
  if (chunks.length === 0) return new Blob([], { type: "text/csv;charset=utf-8" });
  if (chunks.length === 1) return chunks[0]!;

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    let text = stripUtf8Bom(await chunks[i]!.text());
    if (i > 0) {
      const lineEnd = text.search(/\r?\n/);
      if (lineEnd === -1) continue;
      text = text.slice(lineEnd + 1);
      if (text.startsWith("\r")) text = text.slice(1);
    }
    parts.push(text);
  }
  return new Blob(parts, { type: "text/csv;charset=utf-8" });
}

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

  /**
   * GET /api/analytics/events?format=csv — segue X-Next-Cursor até ao fim (um único ficheiro).
   * Para uma única página (API manual), use mergeAllPages: false.
   */
  async downloadEventsCsv(params?: {
    event_type?: string;
    presell_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    mergeAllPages?: boolean;
  }): Promise<{
    data: Blob | null;
    filename: string | null;
    error: string | null;
  }> {
    const mergeAll = params?.mergeAllPages !== false;
    const pageLimit = Math.min(params?.limit ?? 10000, 10000);

    if (!mergeAll) {
      const query = new URLSearchParams();
      query.set("format", "csv");
      if (params?.event_type) query.set("event_type", params.event_type);
      if (params?.presell_id) query.set("presell_id", params.presell_id);
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      query.set("limit", String(pageLimit));
      const qs = query.toString();
      const r = await apiClient.getBlob(`/analytics/events?${qs}`);
      return { data: r.data, filename: r.filename, error: r.error };
    }

    const chunks: Blob[] = [];
    let cursor: string | undefined;
    let filename: string | null = null;

    for (let page = 0; ; page++) {
      const query = new URLSearchParams();
      query.set("format", "csv");
      if (params?.event_type) query.set("event_type", params.event_type);
      if (params?.presell_id) query.set("presell_id", params.presell_id);
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      query.set("limit", String(pageLimit));
      if (cursor) query.set("cursor", cursor);

      const { data, filename: fn, nextCursor, error } = await apiClient.getBlob(`/analytics/events?${query}`);
      if (error || !data) {
        return { data: null, filename: null, error: error ?? "Erro ao exportar." };
      }
      if (page === 0 && fn) filename = fn;
      chunks.push(data);
      if (!nextCursor) break;
      if (page + 1 >= CSV_MAX_PAGES) {
        return {
          data: null,
          filename: null,
          error:
            "Exportação excede o limite de paginação. Reduza o intervalo de datas ou utilize a API com o parâmetro cursor.",
        };
      }
      cursor = nextCursor;
    }

    const merged = chunks.length === 1 ? chunks[0]! : await mergeCsvBlobs(chunks);
    return { data: merged, filename, error: null };
  },

  /**
   * GET /api/analytics/conversions?format=csv — segue X-Next-Cursor até ao fim.
   */
  async downloadConversionsCsv(params?: {
    from?: string;
    to?: string;
    missing_gclid?: boolean;
    limit?: number;
    mergeAllPages?: boolean;
  }): Promise<{
    data: Blob | null;
    filename: string | null;
    error: string | null;
  }> {
    const mergeAll = params?.mergeAllPages !== false;
    const pageLimit = Math.min(params?.limit ?? 10000, 10000);

    if (!mergeAll) {
      const query = new URLSearchParams();
      query.set("format", "csv");
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      if (params?.missing_gclid) query.set("missing_gclid", "1");
      query.set("limit", String(pageLimit));
      const qs = query.toString();
      const r = await apiClient.getBlob(`/analytics/conversions?${qs}`);
      return { data: r.data, filename: r.filename, error: r.error };
    }

    const chunks: Blob[] = [];
    let cursor: string | undefined;
    let filename: string | null = null;

    for (let page = 0; ; page++) {
      const query = new URLSearchParams();
      query.set("format", "csv");
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      if (params?.missing_gclid) query.set("missing_gclid", "1");
      query.set("limit", String(pageLimit));
      if (cursor) query.set("cursor", cursor);

      const { data, filename: fn, nextCursor, error } = await apiClient.getBlob(`/analytics/conversions?${query}`);
      if (error || !data) {
        return { data: null, filename: null, error: error ?? "Erro ao exportar." };
      }
      if (page === 0 && fn) filename = fn;
      chunks.push(data);
      if (!nextCursor) break;
      if (page + 1 >= CSV_MAX_PAGES) {
        return {
          data: null,
          filename: null,
          error:
            "Exportação excede o limite de paginação. Reduza o intervalo de datas ou utilize a API com o parâmetro cursor.",
        };
      }
      cursor = nextCursor;
    }

    const merged = chunks.length === 1 ? chunks[0]! : await mergeCsvBlobs(chunks);
    return { data: merged, filename, error: null };
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
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        utm_term: string | null;
        utm_content: string | null;
        postback_campaign: string | null;
        origin: string;
        commission: number | null;
        currency: string;
        platform: string;
        google_ads_sync: string | null;
        meta_capi_sync: string | null;
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
        meta_capi_integration?: boolean;
      };
      /** Falhas de envio (Google/Meta) em conversões aprovadas no período indicado. */
      sync_health?: {
        period_days: number;
        google_ads_failed: number;
        meta_capi_failed: number;
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

  async getGoogleAdsInsights(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    const { data, error, errorCode } = await apiClient.get<GoogleAdsInsightsBundle>(
      `/analytics/google-ads-insights${qs ? `?${qs}` : ""}`,
    );
    if (error) {
      return { data: null, error, errorCode: errorCode ?? null };
    }
    if (!data) {
      return { data: null, error: "Resposta vazia", errorCode: null };
    }
    return { data, error: null, errorCode: null };
  },

  /**
   * CSV (GCLID) para o assistente de importação manual em Google Ads → Conversões.
   */
  downloadGoogleAdsOfflineImportCsv(params: {
    from: string;
    to: string;
    conversion_name: string;
    include_affiliate?: boolean;
    /** UUIDs de conversões aprovadas (postback); exporta só estas linhas no formato GCLID. */
    conversion_ids?: string[];
  }) {
    const q = new URLSearchParams();
    q.set("from", params.from);
    q.set("to", params.to);
    q.set("conversion_name", params.conversion_name);
    if (params.include_affiliate === false) q.set("include_affiliate", "0");
    if (params.conversion_ids?.length) q.set("conversion_ids", params.conversion_ids.join(","));
    return apiClient.getBlob(`/analytics/google-ads-offline-import.csv?${q.toString()}`);
  },
};

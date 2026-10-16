import { apiClient } from "@/lib/apiClient";

export type KeywordIntent =
  | "BUY"
  | "COMMERCIAL"
  | "INFORMATIONAL"
  | "COMPARISON"
  | "BRAND"
  | "NEGATIVE";

export type KeywordRelevance = "HIGH" | "MEDIUM" | "LOW";

export type NegativeGroup = "JOBS" | "FREE" | "ACCOUNT" | "OTHER";

export type KeywordItem = {
  keyword: string;
  intent: KeywordIntent;
  relevance: KeywordRelevance;
  negativeSuggestion: boolean;
  negativeGroup?: NegativeGroup | null;
  theme?: string;
  matchTypes?: Array<"BROAD" | "PHRASE" | "EXACT">;
  natural?: boolean;
  funnel?: "TOP" | "MIDDLE" | "BOTTOM" | null;
};

export type AdText = { id: string; text: string; pin: 1 | 2 | 3 | null; angle?: string | null };
export type AdDescription = { id: string; text: string; pin: 1 | 2 | null };
export type AdSitelink = { id: string; text: string; url: string; description1: string; description2: string };
export type AdCallout = { id: string; text: string };
export type AdBundle = {
  source: "llm" | "deterministic";
  llmFailed: boolean;
  locale: string;
  platform: "google" | "microsoft" | "both";
  objective: "purchase" | "leads" | "comparison" | "commercial";
  limitations: string[];
  headlines: AdText[];
  descriptions: AdDescription[];
  path1: string;
  path2: string;
  sitelinks: AdSitelink[];
  callouts: AdCallout[];
  snippet: { header: string; values: string[] } | null;
  promotion: {
    kind: "percent" | "amount";
    value: string;
    item: string;
    start: string;
    end: string;
    terms: string;
    url: string;
  } | null;
  businessName: string;
  notes?: string;
  analysis?: {
    pageStatus: "fetched" | "pasted";
    affiliatePlatform: string;
    affiliatePlatformLabel: string;
    funnel: "TOP" | "MIDDLE" | "BOTTOM";
    facts: { label: string; value: string; status: "confirmed" | "quoted" }[];
    missing: string[];
    adGroups: { name: string; intent: string; hint: string }[];
    pageTitle?: string | null;
    pageH1?: string | null;
    suggestedProductName?: string | null;
    productNameSource?: "form" | "page" | "auto" | "merged";
    productAligned?: boolean;
    productAlignmentScore?: number;
    formProductName?: string;
  };
};

export type ValidationIssue = {
  level: "valid" | "warning" | "invalid" | "confirm" | "unsupported";
  code: string;
  path: string;
  message: string;
  platform: string;
};

export type KeywordResearch = {
  id: string;
  product: string;
  language: string;
  language_label: string;
  market: string;
  market_name: string;
  product_url: string | null;
  url_title: string | null;
  keywords: KeywordItem[];
  created_at: string;
  updated_at?: string;
  affiliate_platform?: string | null;
  funnel?: string | null;
  final_url?: string | null;
  platform?: string | null;
  objective?: string | null;
  source?: string | null;
  bundle?: AdBundle | null;
  validation?: ValidationIssue[];
  validation_summary?: Record<string, number> | null;
};

export type KeywordResearchSummary = {
  id: string;
  product: string;
  language: string;
  language_label: string;
  market: string;
  market_name: string;
  funnel?: string | null;
  created_at: string;
  updated_at?: string;
};

export type KeywordOptions = {
  languages: { code: string; label: string }[];
  markets: { code: string; name: string }[];
};

export const keywordResearchService = {
  options() {
    return apiClient.get<KeywordOptions>("/keyword-researches/options");
  },
  list() {
    return apiClient.get<KeywordResearchSummary[]>("/keyword-researches");
  },
  getById(id: string) {
    return apiClient.get<KeywordResearch>(`/keyword-researches/${encodeURIComponent(id)}`);
  },
  generate(body: Record<string, unknown>) {
    return apiClient.post<KeywordResearch>("/keyword-researches/generate", body);
  },
  pagePreview(body: {
    product: string;
    product_url: string;
    language: string;
    page_text?: string;
    product_name_source?: "form" | "page" | "auto";
  }) {
    return apiClient.post<{
      page_status: "fetched" | "pasted";
      page_title: string | null;
      page_h1: string | null;
      suggested_product_name: string | null;
      effective_product_name: string;
      aligned: boolean;
      alignment_score: number;
      product_name_source: string;
    }>("/keyword-researches/page-preview", body);
  },
  update(id: string, body: { keywords: KeywordItem[]; bundle: AdBundle; final_url?: string | null }) {
    return apiClient.patch<KeywordResearch>(`/keyword-researches/${encodeURIComponent(id)}`, body);
  },
};

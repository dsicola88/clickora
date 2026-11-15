import { apiClient } from "@/lib/apiClient";

export type DemandPlannerTimeframe = "default" | "last_24" | "last_36";

export type DemandPlannerIdea = {
  keyword: string;
  monthly_volume: number;
  avg_cpc: number;
  competition: "low" | "medium" | "high";
  monthly_search_volumes?: Array<{ year: number; month: number; monthly_searches: number }>;
};

export type DemandPrimaryKind = "exact_seed" | "close_seed" | "top_related";

export type DemandVolumeTrend = {
  source: "google_monthly";
  timeframe: DemandPlannerTimeframe;
  points: Array<{ year: number; month: number; volume: number }>;
  day_granularity: "unavailable";
};

export type DemandInternalOffer = {
  presell_id: string;
  title: string;
  slug: string;
  status: string;
  clicks: number;
  approved_sales: number;
  revenue: number;
  conversion_rate: number | null;
  source: string;
  source_label: string;
};

export type DemandResearchSummary = {
  id: string;
  product: string;
  language: string;
  market: string;
  market_name: string;
  affiliate_platform: string | null;
  created_at: string;
  updated_at: string;
  source: string;
  source_label: string;
};

export type DemandRadarOverview = {
  period: { days: number; from: string; to: string };
  google_ads: {
    ready: boolean;
    source: string;
    reason: string | null;
    message: string;
  };
  internal_offers: DemandInternalOffer[];
  recent_researches: DemandResearchSummary[];
  honesty: { invents_metrics: boolean; notes: string[] };
};

export type DemandRadarAnalyze = {
  query: {
    product: string;
    market: string;
    language: string;
    timeframe: DemandPlannerTimeframe;
  };
  period: { days: number; from: string; to: string };
  google_ads: DemandRadarOverview["google_ads"];
  planner: {
    status: "ok" | "unavailable";
    source: string | null;
    reason: string | null;
    message: string | null;
    seed_match: DemandPlannerIdea | null;
    primary: DemandPlannerIdea | null;
    primary_kind: DemandPrimaryKind | null;
    ideas: DemandPlannerIdea[];
    trend: DemandVolumeTrend | null;
    source_label: string;
  };
  account: {
    source: string;
    source_label: string;
    matching_offers: DemandInternalOffer[];
    matching_researches: DemandResearchSummary[];
  };
  next_steps: {
    keywords_path: string;
    presell_path: string;
    google_ads_path: string;
  };
  honesty: { invents_metrics: boolean; notes: string[] };
};

export const demandRadarService = {
  overview() {
    return apiClient.get<DemandRadarOverview>("/demand-radar/overview");
  },
  analyze(body: {
    product: string;
    market: string;
    language: string;
    timeframe?: DemandPlannerTimeframe;
  }) {
    return apiClient.post<DemandRadarAnalyze>("/demand-radar/analyze", body);
  },
};

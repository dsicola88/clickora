/**
 * Licitação ao nível da campanha Google Search (REST mutate → objeto Campaign).
 * O CPC efectivo por leilão continua a ser definido pelo Google Ads (Smart Bidding).
 */

export type GoogleBiddingStrategy =
  | "manual_cpc"
  | "maximize_clicks"
  | "maximize_conversions"
  | "target_cpa"
  | "target_roas";

export type StoredGoogleBidding = {
  strategy: GoogleBiddingStrategy;
  /** Micro-unidades USD por conversão quando strategy === target_cpa */
  targetCpaMicros?: string;
  /** Razão receita/custo quando strategy === target_roas */
  targetRoas?: number;
};

export function storedGoogleBiddingFromPlanInput(args: {
  strategy: GoogleBiddingStrategy;
  google_target_cpa_usd?: number | null;
  google_target_roas?: number | null;
}): { google: StoredGoogleBidding } {
  const { strategy, google_target_cpa_usd: cpaUsd, google_target_roas: roas } = args;
  const google: StoredGoogleBidding = { strategy };
  if (strategy === "target_cpa" && cpaUsd != null && Number.isFinite(cpaUsd) && cpaUsd > 0) {
    google.targetCpaMicros = String(Math.round(cpaUsd * 1_000_000));
  }
  if (strategy === "target_roas" && roas != null && Number.isFinite(roas) && roas > 0) {
    google.targetRoas = roas;
  }
  return { google };
}

/** Um só campo «oneof» de licitação compatível com a Campaign REST JSON da Google Ads API. */
export function googleCampaignCreateBiddingOneof(biddingConfig: unknown): Record<string, unknown> {
  const root =
    biddingConfig &&
    typeof biddingConfig === "object" &&
    !Array.isArray(biddingConfig) &&
    "google" in biddingConfig
      ? (biddingConfig as { google?: Record<string, unknown> }).google
      : undefined;
  const strategy = typeof root?.strategy === "string" ? root.strategy : "manual_cpc";

  switch (strategy) {
    case "maximize_clicks":
      /** Legacy name no UI — na API Campaign o oneof usa `target_spend` ("Target Spend" = máximos cliques dentro do orçamento). */
      return { targetSpend: {} };
    case "maximize_conversions":
      return { maximizeConversions: {} };
    case "target_cpa": {
      const micros = parsePositiveMicros(root?.targetCpaMicros);
      if (!micros) return { manualCpc: {} };
      return { targetCpa: { targetCpaMicros: micros } };
    }
    case "target_roas": {
      const ro = parsePositiveRoas(root?.targetRoas);
      if (ro == null) return { manualCpc: {} };
      return { targetRoas: { targetRoas: ro } };
    }
    default:
      return { manualCpc: {} };
  }
}

function parsePositiveMicros(v: unknown): string | null {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number" && Number.isFinite(v) && v >= 1) return String(Math.round(v));
  if (typeof v === "string" && /^\d+$/.test(v) && BigInt(v) >= 1n) return v;
  return null;
}

function parsePositiveRoas(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

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
  /** Lance máximo CPC em micro-unidades USD quando strategy === manual_cpc.
   *  Aplicado como `cpcBidMicros` ao criar cada AdGroup; serve de tecto aos lances
   *  por palavra-chave e materializa a equação «CPC = orçamento ÷ cliques alvo» do UI. */
  manualCpcMicros?: string;
};

export function storedGoogleBiddingFromPlanInput(args: {
  strategy: GoogleBiddingStrategy;
  google_target_cpa_usd?: number | null;
  google_target_roas?: number | null;
  /** USD por clique escolhido pelo utilizador para `manual_cpc` (opcional). */
  google_max_cpc_usd?: number | null;
}): { google: StoredGoogleBidding } {
  const {
    strategy,
    google_target_cpa_usd: cpaUsd,
    google_target_roas: roas,
    google_max_cpc_usd: maxCpcUsd,
  } = args;
  const google: StoredGoogleBidding = { strategy };
  if (strategy === "target_cpa" && cpaUsd != null && Number.isFinite(cpaUsd) && cpaUsd > 0) {
    google.targetCpaMicros = String(Math.round(cpaUsd * 1_000_000));
  }
  if (strategy === "target_roas" && roas != null && Number.isFinite(roas) && roas > 0) {
    google.targetRoas = roas;
  }
  if (strategy === "manual_cpc" && maxCpcUsd != null && Number.isFinite(maxCpcUsd) && maxCpcUsd > 0) {
    google.manualCpcMicros = String(Math.round(maxCpcUsd * 1_000_000));
  }
  return { google };
}

/** Devolve o `cpcBidMicros` a aplicar em cada AdGroup quando o utilizador definiu CPC máximo
 *  e escolheu `manual_cpc`. Em qualquer outra estratégia (ou sem valor) devolve `null`. */
export function googleAdGroupCpcBidMicros(biddingConfig: unknown): string | null {
  const root =
    biddingConfig &&
    typeof biddingConfig === "object" &&
    !Array.isArray(biddingConfig) &&
    "google" in biddingConfig
      ? (biddingConfig as { google?: Record<string, unknown> }).google
      : undefined;
  const strategy = typeof root?.strategy === "string" ? root.strategy : null;
  if (strategy !== "manual_cpc") return null;
  return parsePositiveMicros(root?.manualCpcMicros);
}

/** Um só campo «oneof» de licitação compatível com a Campaign REST JSON da Google Ads API. */
/** Campos snake_case esperados pelo `updateMask` na mutação `campaigns` ao alterar apenas a licitação. */
export function googleCampaignBiddingUpdateMask(fragment: Record<string, unknown>): string {
  const parts: string[] = [];
  if ("manualCpc" in fragment) parts.push("manual_cpc");
  if ("maximizeConversions" in fragment) parts.push("maximize_conversions");
  if ("targetCpa" in fragment) parts.push("target_cpa");
  if ("targetRoas" in fragment) parts.push("target_roas");
  if ("targetSpend" in fragment) parts.push("target_spend");
  return [...new Set(parts)].join(",");
}

/** Preserva `google_asset_extensions` e outros extras em `biddingConfig` ao trocar a estratégia. */
export function mergeGoogleBiddingConfigPreservingExtras(
  previous: unknown,
  nextStored: { google: StoredGoogleBidding },
): Record<string, unknown> {
  const prev =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? (previous as Record<string, unknown>)
      : {};
  const { google_asset_extensions: ext, google: _g, ...rest } = prev;
  return {
    ...rest,
    google: nextStored.google,
    ...(ext !== undefined ? { google_asset_extensions: ext } : {}),
  };
}

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

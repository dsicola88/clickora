/**
 * Preferências de licitação Meta (Graph API ad set) e TikTok (ad group).
 * Os valores efectivos no leilão continuam definidos pela rede.
 */

export type MetaBiddingStrategy = "lowest_cost" | "bid_cap_usd" | "cost_cap_usd";

export type StoredMetaBidding = {
  strategy: MetaBiddingStrategy;
  /** USD — limite / cap conforme strategy */
  bid_amount_usd?: number;
};

export type TikTokBiddingStrategy = "lowest_cost" | "bid_cap_usd";

export type StoredTikTokBidding = {
  strategy: TikTokBiddingStrategy;
  bid_amount_usd?: number;
};

export function storedMetaBiddingFromPlanInput(args: {
  meta_bidding_strategy: MetaBiddingStrategy;
  meta_bid_amount_usd?: number | null;
}): { meta: StoredMetaBidding } {
  const meta: StoredMetaBidding = { strategy: args.meta_bidding_strategy };
  const usd = args.meta_bid_amount_usd;
  if (
    (args.meta_bidding_strategy === "bid_cap_usd" || args.meta_bidding_strategy === "cost_cap_usd") &&
    usd != null &&
    Number.isFinite(usd) &&
    usd > 0
  ) {
    meta.bid_amount_usd = usd;
  }
  return { meta };
}

export function storedTikTokBiddingFromPlanInput(args: {
  tiktok_bidding_strategy: TikTokBiddingStrategy;
  tiktok_bid_amount_usd?: number | null;
}): { tiktok: StoredTikTokBidding } {
  const tiktok: StoredTikTokBidding = { strategy: args.tiktok_bidding_strategy };
  const usd = args.tiktok_bid_amount_usd;
  if (args.tiktok_bidding_strategy === "bid_cap_usd" && usd != null && Number.isFinite(usd) && usd > 0) {
    tiktok.bid_amount_usd = usd;
  }
  return { tiktok };
}

/** Centavos USD para o campo `bid_amount` do Graph API (USD/EUR, etc.). */
function usdToCents(usd: unknown): number {
  const n =
    typeof usd === "number"
      ? usd
      : typeof usd === "string"
        ? parseFloat(usd)
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/**
 * Meta Ad Set: LOWEST_COST_WITHOUT_CAP | LOWEST_COST_WITH_BID_CAP | COST_CAP.
 * COST_CAP costuma funcionar melhor com conversões/leads; para OUTCOME_TRAFFIC etc.
 * faz downgrade para bid cap (mesmo valor USD como teto de licitação).
 */
export function metaGraphAdsetBiddingFields(
  biddingConfig: unknown,
  campaignObjective: string,
): { bid_strategy: string; bid_amount?: string } {
  const root =
    biddingConfig &&
    typeof biddingConfig === "object" &&
    !Array.isArray(biddingConfig) &&
    "meta" in biddingConfig
      ? (biddingConfig as { meta?: Record<string, unknown> }).meta
      : undefined;
  const strat = typeof root?.strategy === "string" ? root.strategy : "lowest_cost";
  const cents = usdToCents(root?.bid_amount_usd);

  if (strat === "bid_cap_usd" && cents >= 1) {
    return { bid_strategy: "LOWEST_COST_WITH_BID_CAP", bid_amount: String(cents) };
  }

  if (strat === "cost_cap_usd" && cents >= 1) {
    const obj = campaignObjective.toUpperCase();
    const costCapRisky =
      obj === "OUTCOME_TRAFFIC" ||
      obj === "OUTCOME_AWARENESS" ||
      obj === "OUTCOME_ENGAGEMENT" ||
      obj === "OUTCOME_APP_PROMOTION";
    if (costCapRisky) {
      return { bid_strategy: "LOWEST_COST_WITH_BID_CAP", bid_amount: String(cents) };
    }
    return { bid_strategy: "COST_CAP", bid_amount: String(cents) };
  }

  return { bid_strategy: "LOWEST_COST_WITHOUT_CAP" };
}

/** Campos opcionais para `adgroup/create/` TikTok v1.3 */
export function tiktokAdgroupBidExtras(biddingConfig: unknown): Record<string, unknown> {
  const root =
    biddingConfig &&
    typeof biddingConfig === "object" &&
    !Array.isArray(biddingConfig) &&
    "tiktok" in biddingConfig
      ? (biddingConfig as { tiktok?: Record<string, unknown> }).tiktok
      : undefined;
  const strat = typeof root?.strategy === "string" ? root.strategy : "lowest_cost";
  const usdRaw = root?.bid_amount_usd;
  const usd =
    typeof usdRaw === "number"
      ? usdRaw
      : typeof usdRaw === "string"
        ? parseFloat(usdRaw)
        : NaN;

  if (strat === "bid_cap_usd" && Number.isFinite(usd) && usd > 0) {
    const bid = Math.round(usd * 100) / 100;
    return {
      bid_type: "BID_TYPE_CUSTOM",
      bid_price: bid,
    };
  }

  return {};
}

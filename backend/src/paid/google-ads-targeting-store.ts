/**
 * Segmentação Google Ads guardada em biddingConfig.targeting (sem misturar com licitação).
 */
export type GoogleDeviceBidKey = "MOBILE" | "DESKTOP" | "TABLET";

export type GoogleAgeRangeKey =
  | "AGE_RANGE_18_24"
  | "AGE_RANGE_25_34"
  | "AGE_RANGE_35_44"
  | "AGE_RANGE_45_54"
  | "AGE_RANGE_55_64"
  | "AGE_RANGE_65_UP"
  | "AGE_RANGE_UNDETERMINED";

export type GoogleCampaignTargetingStored = {
  /** Países excluídos (ISO-2). Inclusões ficam em paid_ads_campaigns.geoTargets. */
  geo_exclude?: string[];
  /**
   * Ajuste de lance por dispositivo em % (−100 = excluir).
   * Ex.: { MOBILE: -20, DESKTOP: 0, TABLET: -100 }
   */
  device_bids?: Partial<Record<GoogleDeviceBidKey, number>>;
  /** Faixas etárias a excluir (negativas no grupo). */
  age_exclude?: GoogleAgeRangeKey[];
};

export function readGoogleCampaignTargeting(biddingConfig: unknown): GoogleCampaignTargetingStored {
  if (!biddingConfig || typeof biddingConfig !== "object" || Array.isArray(biddingConfig)) {
    return {};
  }
  const raw = (biddingConfig as Record<string, unknown>).targeting;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const geo_exclude = Array.isArray(o.geo_exclude)
    ? o.geo_exclude.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
    : undefined;
  const age_exclude = Array.isArray(o.age_exclude)
    ? (o.age_exclude
        .map((x) => String(x).trim())
        .filter(Boolean) as GoogleAgeRangeKey[])
    : undefined;
  let device_bids: GoogleCampaignTargetingStored["device_bids"];
  if (o.device_bids && typeof o.device_bids === "object" && !Array.isArray(o.device_bids)) {
    const d = o.device_bids as Record<string, unknown>;
    device_bids = {};
    for (const key of ["MOBILE", "DESKTOP", "TABLET"] as const) {
      const n = Number(d[key]);
      if (Number.isFinite(n)) device_bids[key] = Math.max(-100, Math.min(900, Math.round(n)));
    }
  }
  return {
    ...(geo_exclude?.length ? { geo_exclude } : {}),
    ...(device_bids && Object.keys(device_bids).length ? { device_bids } : {}),
    ...(age_exclude?.length ? { age_exclude } : {}),
  };
}

/** Mescla targeting sem apagar outras chaves de biddingConfig. */
export function mergeBiddingConfigTargeting(
  biddingConfig: unknown,
  patch: GoogleCampaignTargetingStored,
): Record<string, unknown> {
  const base =
    biddingConfig && typeof biddingConfig === "object" && !Array.isArray(biddingConfig)
      ? { ...(biddingConfig as Record<string, unknown>) }
      : {};
  const prev = readGoogleCampaignTargeting(base);
  const next: GoogleCampaignTargetingStored = {
    geo_exclude: patch.geo_exclude !== undefined ? patch.geo_exclude : prev.geo_exclude,
    device_bids: patch.device_bids !== undefined ? { ...prev.device_bids, ...patch.device_bids } : prev.device_bids,
    age_exclude: patch.age_exclude !== undefined ? patch.age_exclude : prev.age_exclude,
  };
  base.targeting = next;
  return base;
}

/** % → bid_modifier Google (−100% → −1; 0% → 1.0; +20% → 1.2). */
export function percentToGoogleBidModifier(pct: number): number {
  if (pct <= -100) return -1;
  return 1 + pct / 100;
}

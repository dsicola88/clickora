/** Espelha `CLICK_ID_KEYS` / política Final URL Google Ads (lander limpa). */
const CLICK_ID_KEYS = new Set(["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid"]);

export type GoogleAdsPresellUrlParts = {
  /** Campo «URL final» — sem query. */
  finalUrl: string;
  /** Campo «Sufixo da URL final» — sem `?` no início. */
  finalUrlSuffix: string;
  /** Legado: uma só string (evitar colar na Final URL; usar só para testes/QA lander). */
  combinedTrackingUrl: string;
};

function hasUnreplacedMacro(value: string): boolean {
  return /\{[a-z0-9_.]+\}/i.test(value) || /\{\{[a-z0-9_.]+\}\}/i.test(value);
}

/**
 * Lander limpa para o campo Final URL do Google Ads.
 * Remove toda a query (UTMs/ValueTrack vão no sufixo).
 */
export function cleanPresellUrlForGoogleFinalBase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
  }
}

/** Nome legível para `utm_campaign` (título da presell/campanha). */
export function presellAdsCampaignName(title?: string | null, slug?: string | null): string {
  const t = title?.trim();
  if (t) return t;
  const s = slug?.trim();
  if (s) return s;
  return "campanha";
}

export function campaignUtmSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "campanha";
}

export function buildAdsUtmOverrides(
  campaignName: string,
  trafficSource: string,
  existing: URLSearchParams,
): Record<string, string> {
  const slug = campaignUtmSlug(campaignName);
  const src = trafficSource.toLowerCase();
  const isGoogle = src.includes("google");
  const isBing = src.includes("bing") || src.includes("microsoft");

  const overrides: Record<string, string> = {};
  if (!existing.has("utm_source")) {
    overrides.utm_source = src.replace(/\s+/g, "_") || "ads";
  }
  if (!existing.has("utm_medium")) overrides.utm_medium = "cpc";
  overrides.utm_campaign = slug;
  if ((isGoogle || isBing) && !existing.has("utm_term")) {
    overrides.utm_term = "{keyword}";
  }
  if (isGoogle && !existing.has("utm_content")) {
    overrides.utm_content = "{adgroupid}";
  }
  if (isBing && !existing.has("utm_content")) {
    overrides.utm_content = "{AdGroupId}";
  }
  return overrides;
}

function encodeQueryValue(v: string): string {
  return v.includes("{") ? v : encodeURIComponent(v);
}

/** Monta sufixo (sem `?`). Ignora click IDs e macros já na query da base. */
export function buildGoogleAdsFinalUrlSuffix(
  campaignName: string,
  trafficSource: string,
  basePresellUrl?: string,
): string {
  let existing = new URLSearchParams();
  if (basePresellUrl) {
    try {
      const u = new URL(basePresellUrl.trim());
      for (const [k, v] of u.searchParams.entries()) {
        const lk = k.toLowerCase();
        if (CLICK_ID_KEYS.has(lk) || hasUnreplacedMacro(v) || hasUnreplacedMacro(k)) continue;
        existing.set(k, v);
      }
    } catch {
      /* ignore */
    }
  }

  const overrides = buildAdsUtmOverrides(campaignName, trafficSource, existing);
  const parts: string[] = [];
  existing.forEach((v, k) => {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) return;
    parts.push(`${encodeURIComponent(k)}=${encodeQueryValue(v)}`);
  });
  for (const [k, v] of Object.entries(overrides)) {
    parts.push(`${encodeURIComponent(k)}=${encodeQueryValue(v)}`);
  }
  return parts.join("&");
}

export function buildGoogleAdsPresellUrlParts(
  basePresellUrl: string,
  campaignName: string,
  trafficSource: string,
): GoogleAdsPresellUrlParts {
  const finalUrl = cleanPresellUrlForGoogleFinalBase(basePresellUrl);
  const finalUrlSuffix = buildGoogleAdsFinalUrlSuffix(campaignName, trafficSource, basePresellUrl);
  const combinedTrackingUrl = finalUrlSuffix ? `${finalUrl}?${finalUrlSuffix}` : finalUrl;
  return { finalUrl, finalUrlSuffix, combinedTrackingUrl };
}
/** Query `?landing=` — a URL pública da presell segue até o assistente Google Ads. */
export const DPILOT_LANDING_QUERY = "landing";

/**
 * Final URL do Google Ads não deve levar ValueTrack (`{keyword}`, `{gclid}`, …).
 * Esses parâmetros ficam no sufixo / tracking template; a Final URL é a lander limpa.
 */
export function sanitizeLandingUrlForAdsFinal(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    const dropKeys = new Set(["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid"]);
    for (const key of [...u.searchParams.keys()]) {
      const v = u.searchParams.get(key) ?? "";
      if (dropKeys.has(key.toLowerCase()) || /\{[a-z0-9_.]+\}/i.test(v)) {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return "";
  }
}

export function parseDpilotLandingQuery(search: string | URLSearchParams): string {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const raw = params.get(DPILOT_LANDING_QUERY)?.trim() ?? "";
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    /** Não usar `href`: serializa `{gclid}`/`{keyword}` e parte o ValueTrack do anúncio. */
    return sanitizeLandingUrlForAdsFinal(raw) || raw;
  } catch {
    return "";
  }
}

/** Entrada do módulo Ads; o redirect escolhe o projecto e abre o assistente Google. */
export function dpilotAdsHandoffHref(landingUrl: string): string {
  const trimmed = sanitizeLandingUrlForAdsFinal(landingUrl.trim()) || landingUrl.trim();
  if (!trimmed) return "/tracking/dpilot";
  const q = new URLSearchParams();
  q.set(DPILOT_LANDING_QUERY, trimmed);
  return `/tracking/dpilot?${q.toString()}`;
}

export function dpilotGoogleCampaignHref(projectId: string, landingUrl: string): string {
  const q = new URLSearchParams();
  const trimmed = sanitizeLandingUrlForAdsFinal(landingUrl.trim()) || landingUrl.trim();
  if (trimmed) q.set(DPILOT_LANDING_QUERY, trimmed);
  const qs = q.toString();
  return `/tracking/dpilot/p/${projectId}/campanhas/nova${qs ? `?${qs}` : ""}`;
}

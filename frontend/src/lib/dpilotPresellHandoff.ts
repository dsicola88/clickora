/** Query `?landing=` — a URL pública da presell segue até o assistente Google Ads. */
export const DPILOT_LANDING_QUERY = "landing";

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
    return raw;
  } catch {
    return "";
  }
}

/** Entrada do módulo Ads; o redirect escolhe o projecto e abre o assistente Google. */
export function dpilotAdsHandoffHref(landingUrl: string): string {
  const trimmed = landingUrl.trim();
  if (!trimmed) return "/tracking/dpilot";
  const q = new URLSearchParams();
  q.set(DPILOT_LANDING_QUERY, trimmed);
  return `/tracking/dpilot?${q.toString()}`;
}

export function dpilotGoogleCampaignHref(projectId: string, landingUrl: string): string {
  const q = new URLSearchParams();
  const trimmed = landingUrl.trim();
  if (trimmed) q.set(DPILOT_LANDING_QUERY, trimmed);
  const qs = q.toString();
  return `/tracking/dpilot/p/${projectId}/campanhas/nova${qs ? `?${qs}` : ""}`;
}

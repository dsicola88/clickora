import { getTrackApiBaseUrl } from "@/lib/apiOrigin";
import { bakeHtmlOfferHrefs } from "@/lib/presellOfferHrefBake";

/**
 * Bake enterprise: hoplinks → `/track/r/:presellId?to=<oferta>` no HTML espelhado.
 * Sem `to=` (ou `to=` vazio/#), o hop usa o hoplink da presell; `to` inválido cloaka (HTML seguro, não JSON 400).
 * `apiBase` opcional: preferir domínio de tracking da conta / lander (export); senão same-origin do painel.
 */
export function trackHrefForPresell(
  presellId: string,
  affiliateHref = "",
  apiBase?: string | null,
): string {
  const base = (apiBase?.trim() || getTrackApiBaseUrl()).replace(/\/+$/, "");
  const url = `${base}/track/r/${presellId}`;
  const offer = affiliateHref.trim();
  if (!offer || offer === "#" || !/^https?:\/\//i.test(offer)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}to=${encodeURIComponent(offer)}`;
}

export function bakeMirrorOfferHrefsForPresell(
  html: string,
  presellId: string,
  affiliateHref = "",
  apiBase?: string | null,
): string {
  if (!html || !presellId) return html;
  return bakeHtmlOfferHrefs(
    html,
    trackHrefForPresell(presellId, affiliateHref, apiBase),
    affiliateHref,
  );
}

import { getTrackApiBaseUrl } from "@/lib/apiOrigin";
import { bakeHtmlOfferHrefs } from "@/lib/presellOfferHrefBake";

/**
 * Bake enterprise: hoplinks → `/track/r/:presellId?to=<oferta>` no HTML espelhado.
 * Sem `to=`, o hop `/track/r/` devolve 400 — o visitante do anúncio não pode ver JSON.
 */
export function trackHrefForPresell(presellId: string, affiliateHref = ""): string {
  const base = getTrackApiBaseUrl().replace(/\/+$/, "");
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
): string {
  if (!html || !presellId) return html;
  return bakeHtmlOfferHrefs(html, trackHrefForPresell(presellId, affiliateHref), affiliateHref);
}

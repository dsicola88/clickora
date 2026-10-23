import { getTrackApiBaseUrl } from "@/lib/apiOrigin";
import { bakeHtmlOfferHrefs } from "@/lib/presellOfferHrefBake";

/**
 * Bake enterprise: hoplinks → `/track/r/:presellId` no HTML espelhado.
 * Alinha dashboard, wizard e checklist — a pública ainda re-bake, mas o HTML fica pronto a anunciar.
 */
export function trackHrefForPresell(presellId: string): string {
  const base = getTrackApiBaseUrl().replace(/\/+$/, "");
  return `${base}/track/r/${presellId}`;
}

export function bakeMirrorOfferHrefsForPresell(
  html: string,
  presellId: string,
  affiliateHref = "",
): string {
  if (!html || !presellId) return html;
  return bakeHtmlOfferHrefs(html, trackHrefForPresell(presellId), affiliateHref);
}

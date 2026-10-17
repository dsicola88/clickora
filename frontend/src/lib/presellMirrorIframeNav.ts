import { hrefLooksLikeOfferLink, isCtaLabel } from "@/lib/presellOfferHrefBake";

const OFFER_CTA_FALLBACK =
  /order\s*now|buy\s*now|shop\s*now|comprar|official|checkout|claim|get\s+yours|add to cart/i;

export function mirrorAnchorLabel(anchor: HTMLAnchorElement): string {
  return `${anchor.textContent || ""} ${anchor.getAttribute("aria-label") || ""} ${anchor.className || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

export function mirrorAnchorLooksCommercial(anchor: HTMLAnchorElement): boolean {
  const blob = mirrorAnchorLabel(anchor);
  return OFFER_CTA_FALLBACK.test(blob) || isCtaLabel(blob);
}

/**
 * Decide se um clique num `<a>` do espelho deve abrir o hoplink rastreado na janela principal.
 * Links `/track/` com target=_top falham no sandbox do iframe sem isto.
 */
export function resolveMirrorAnchorNavigateHref(
  anchor: HTMLAnchorElement,
  trackOfferHref: string,
  affiliateHref = "",
): string | null {
  const offer = trackOfferHref.trim();
  if (!offer || offer === "#") return null;

  const raw = (anchor.getAttribute("href") || "").trim();
  if (!raw || /^mailto:|^tel:/i.test(raw)) return null;

  const commercial = mirrorAnchorLooksCommercial(anchor);
  const isTrack =
    raw === offer ||
    raw.includes("/track/") ||
    raw.includes("clickora.invalid/__TRACK") ||
    anchor.getAttribute("data-clickora-offer") === "1";

  if (raw.startsWith("#")) {
    return commercial ? offer : null;
  }

  if (isTrack) return raw.includes("clickora.invalid") ? offer : raw;
  if (hrefLooksLikeOfferLink(raw, affiliateHref)) return offer;
  if (commercial) return offer;
  return null;
}

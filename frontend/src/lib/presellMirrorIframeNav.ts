import { hrefLooksLikeOfferLink, isCtaLabel } from "@/lib/presellOfferHrefBake";
import { isCommerceHashHref } from "@/lib/presellCommerceHash";

const OFFER_CTA_FALLBACK =
  /order\s*now|buy\s*now|shop\s*now|comprar|official|checkout|claim|get\s+yours|add to cart/i;

const BUTTONISH_CLASS =
  /\b(btn|button|cta|elementor-button|wp-block-button|shop-button|buy-button|offer-button|add-to-cart|nav-link-btn)\b/i;

export function mirrorAnchorLabel(anchor: HTMLAnchorElement): string {
  return `${anchor.textContent || ""} ${anchor.getAttribute("aria-label") || ""} ${anchor.className || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function anchorHasOrderNowVisual(anchor: HTMLAnchorElement): boolean {
  return Boolean(
    anchor.querySelector("img.order-now-button, img[src*='order-now'], img[alt*='order' i]"),
  );
}

export function mirrorAnchorLooksCommercial(anchor: HTMLAnchorElement): boolean {
  const blob = mirrorAnchorLabel(anchor);
  const href = (anchor.getAttribute("href") || "").trim();
  return (
    OFFER_CTA_FALLBACK.test(blob) ||
    isCtaLabel(blob) ||
    isCommerceHashHref(href) ||
    BUTTONISH_CLASS.test(anchor.className || "") ||
    anchorHasOrderNowVisual(anchor)
  );
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

  if (anchor.getAttribute("data-clickora-offer") === "1") {
    if (/\/track\/r\//i.test(raw)) {
      return raw.includes("clickora.invalid") ? offer : raw;
    }
    return offer;
  }

  const commercial = mirrorAnchorLooksCommercial(anchor);
  const isTrack =
    raw === offer ||
    raw.includes("/track/") ||
    raw.includes("clickora.invalid/__TRACK") ||
    anchor.getAttribute("data-clickora-offer") === "1";

  if (raw.startsWith("#")) {
    return commercial || isCommerceHashHref(raw) ? offer : null;
  }

  if (isTrack) return raw.includes("clickora.invalid") ? offer : raw;
  if (hrefLooksLikeOfferLink(raw, affiliateHref)) return offer;
  if (commercial) return offer;
  return null;
}

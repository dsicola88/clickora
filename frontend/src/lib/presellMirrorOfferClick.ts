import { isCommerceHashHref } from "@/lib/presellCommerceHash";
import { hrefLooksLikeOfferLink, isCtaLabel } from "@/lib/presellOfferHrefBake";
import { mirrorAnchorLooksCommercial, resolveMirrorAnchorNavigateHref } from "@/lib/presellMirrorIframeNav";
import { navigatePresellOfferFromMirrorEvent } from "@/lib/presellMirrorOfferNavigate";

const OFFER_SELECTOR =
  "a, button, input[type='submit'], input[type='button'], [role='button'], [data-eltype='button'], .anchor_to_product, [data-button-text]";

function elementLabel(el: Element): string {
  if (el instanceof HTMLInputElement) return (el.value || el.getAttribute("aria-label") || "").trim();
  const btnText = el.querySelector?.("[data-button-text]")?.textContent;
  if (btnText?.trim()) return btnText.replace(/\s+/g, " ").trim();
  return (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "")
    .replace(/\s+/g, " ")
    .trim();
}

function elementLooksCommercial(el: Element): boolean {
  if (el.getAttribute("data-clickora-offer") === "1") return true;
  if (el instanceof HTMLAnchorElement) return mirrorAnchorLooksCommercial(el);
  const label = elementLabel(el);
  return (
    isCtaLabel(label) ||
    /\b(btn|button|cta|anchor_to_product)\b/i.test(el.className) ||
    el.getAttribute("data-eltype") === "button"
  );
}

/** Marca CTAs comerciais sem alterar href, classes nem texto (só metadata). */
export function tagMirrorOfferElementsInDocument(doc: Document): void {
  doc.querySelectorAll("a[href]").forEach((node) => {
    const a = node as HTMLAnchorElement;
    const href = (a.getAttribute("href") || "").trim();
    if (!href || /^mailto:|^tel:/i.test(href)) return;
    if (isCommerceHashHref(href)) {
      a.setAttribute("data-clickora-offer", "1");
      return;
    }
    if (/\/track\/r\//i.test(href) || href.includes("clickora.invalid/__TRACK")) {
      a.setAttribute("data-clickora-offer", "1");
      return;
    }
    if (hrefLooksLikeOfferLink(href, "") || mirrorAnchorLooksCommercial(a)) {
      a.setAttribute("data-clickora-offer", "1");
    }
  });

  doc
    .querySelectorAll(
      "button, input[type='submit'], input[type='button'], [role='button'], [data-eltype='button'], .anchor_to_product",
    )
    .forEach((el) => {
      if (elementLooksCommercial(el)) el.setAttribute("data-clickora-offer", "1");
    });
}

export function resolveMirrorClickDestination(
  el: Element,
  trackOfferHref: string,
  affiliateHref = "",
): string | null {
  const offer = trackOfferHref.trim();
  if (!offer || offer === "#") return null;

  if (el instanceof HTMLAnchorElement) {
    return resolveMirrorAnchorNavigateHref(el, offer, affiliateHref);
  }

  if (
    el.getAttribute("data-clickora-offer") === "1" ||
    (el instanceof HTMLButtonElement && elementLooksCommercial(el)) ||
    (el.getAttribute("role") === "button" && elementLooksCommercial(el))
  ) {
    return offer;
  }
  return null;
}

function onMirrorPointerEvent(e: Event, trackOfferHref: string, affiliateHref: string): void {
  const node = e.target;
  if (!(node instanceof Element)) return;
  const hit = node.closest(OFFER_SELECTOR);
  if (!hit) return;
  const dest = resolveMirrorClickDestination(hit, trackOfferHref, affiliateHref);
  if (!dest) return;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  navigatePresellOfferFromMirrorEvent(e, dest);
}

/** Captura cliques (fase capture) no documento do iframe — #order-now, botões, /track/. */
export function bindMirrorOfferClickCapture(
  doc: Document,
  trackOfferHref: string,
  affiliateHref = "",
): () => void {
  const offer = trackOfferHref.trim();
  if (!offer || offer === "#") return () => undefined;

  tagMirrorOfferElementsInDocument(doc);

  const handler = (e: Event) => onMirrorPointerEvent(e, offer, affiliateHref);
  doc.addEventListener("click", handler, true);
  return () => {
    doc.removeEventListener("click", handler, true);
  };
}

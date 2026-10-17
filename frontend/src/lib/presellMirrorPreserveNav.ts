import { isCommerceHashHref } from "@/lib/presellCommerceHash";
import { isCtaLabel } from "@/lib/presellOfferHrefBake";

const NAV_ORDER =
  /order\s*now|buy\s*now|shop\s*now|claim|checkout|comprar|get\s+yours/i;

/**
 * Mantém o visual original dos CTAs de menu (#order-now + CSS da sales page).
 * Só o clique é interceptado no iframe — o href não deve virar /track/ no header.
 */
export function preserveNavHashCtaAppearance(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const roots = doc.querySelectorAll(
    "header, nav, [class*='header'], [class*='Header'], [class*='navbar'], [class*='Navbar'], [class*='menu']",
  );
  const anchors: Element[] = [];
  roots.forEach((root) => {
    root.querySelectorAll("a").forEach((a) => anchors.push(a));
  });

  for (const a of anchors) {
    const href = (a.getAttribute("href") || "").trim();
    const label = (a.textContent || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    const tracked = /\/track\/r\//i.test(href) || href.includes("clickora.invalid/__TRACK");
    const hashCta = isCommerceHashHref(href);
    const looksOrder = NAV_ORDER.test(label) || isCtaLabel(label);

    if (!tracked && !hashCta) continue;
    if (!looksOrder && !hashCta && !/\b(btn|button|cta)\b/i.test(a.className)) continue;

    const hash = hashCta ? href : "#order-now";
    a.setAttribute("href", hash);
    a.setAttribute("data-clickora-offer", "1");
    a.removeAttribute("data-clickora-hash-cta");
    a.removeAttribute("target");
  }

  return doc.documentElement.outerHTML;
}

import { isCommerceHashHref } from "@/lib/presellCommerceHash";
import { isCtaLabel } from "@/lib/presellOfferHrefBake";

const NAV_ORDER =
  /order\s*now|buy\s*now|shop\s*now|claim|checkout|comprar|get\s+yours/i;

/**
 * Garante CTAs do menu (#order-now / Order Now) com hoplink rastreado + target=_top.
 * Não reverte para #order-now — isso só fazia scroll e quebrava o redirect.
 * O visual Neotonics vem de `.order-now-button` na <img>, não do href.
 */
export function preserveNavHashCtaAppearance(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  const markOffer = (a: HTMLAnchorElement) => {
    a.setAttribute("data-clickora-offer", "1");
    a.setAttribute("target", "_top");
    a.setAttribute("rel", "noopener noreferrer");
    a.removeAttribute("data-clickora-hash-cta");
  };

  doc.querySelectorAll("a[href]").forEach((node) => {
    const a = node as HTMLAnchorElement;
    const href = (a.getAttribute("href") || "").trim();
    if (isCommerceHashHref(href) || /\/track\/r\//i.test(href) || href.includes("clickora.invalid/__TRACK")) {
      markOffer(a);
    }
  });

  const navRoots = doc.querySelectorAll(
    "header, nav, section.top-nav, [class*='top-nav'], [class*='header'], [class*='Header'], [class*='navbar'], [class*='Navbar'], [class*='menu'], [class*='top-bar'], [class*='TopBar']",
  );
  navRoots.forEach((root) => {
    root.querySelectorAll("a[href]").forEach((node) => {
      const a = node as HTMLAnchorElement;
      const href = (a.getAttribute("href") || "").trim();
      const label = (a.textContent || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      const hasOrderImg = Boolean(
        a.querySelector("img.order-now-button, img[src*='order-now'], img[alt*='order' i]"),
      );
      const tracked = /\/track\/r\//i.test(href) || href.includes("clickora.invalid/__TRACK");
      const hashCta = isCommerceHashHref(href);
      const looksOrder = NAV_ORDER.test(label) || isCtaLabel(label) || hasOrderImg;

      if (!tracked && !hashCta && !looksOrder) return;
      if (!looksOrder && !hashCta && !tracked && !/\b(btn|button|cta)\b/i.test(a.className)) return;

      markOffer(a);
    });
  });

  return doc.documentElement.outerHTML;
}

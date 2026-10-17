import { isCommerceHashHref } from "@/lib/presellCommerceHash";
import { isCtaLabel } from "@/lib/presellOfferHrefBake";

const NAV_ORDER =
  /order\s*now|buy\s*now|shop\s*now|claim|checkout|comprar|get\s+yours/i;

/**
 * Mantém href/CSS original (#order-now). Só metadata + restaura links do menu que foram para /track/.
 */
export function preserveNavHashCtaAppearance(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("a[href]").forEach((node) => {
    const a = node as HTMLAnchorElement;
    const href = (a.getAttribute("href") || "").trim();
    if (isCommerceHashHref(href)) {
      a.setAttribute("data-clickora-offer", "1");
    }
  });

  const navRoots = doc.querySelectorAll(
    "header, nav, [class*='header'], [class*='Header'], [class*='navbar'], [class*='Navbar'], [class*='menu'], [class*='top-bar'], [class*='TopBar']",
  );
  navRoots.forEach((root) => {
    root.querySelectorAll("a[href]").forEach((node) => {
      const a = node as HTMLAnchorElement;
      const href = (a.getAttribute("href") || "").trim();
      const label = (a.textContent || a.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      const tracked = /\/track\/r\//i.test(href) || href.includes("clickora.invalid/__TRACK");
      const hashCta = isCommerceHashHref(href);
      const looksOrder = NAV_ORDER.test(label) || isCtaLabel(label);

      if (!tracked && !hashCta) return;
      if (!looksOrder && !hashCta && !/\b(btn|button|cta)\b/i.test(a.className)) return;

      if (tracked && !hashCta) {
        a.setAttribute("href", "#order-now");
      }
      a.setAttribute("data-clickora-offer", "1");
      a.removeAttribute("data-clickora-hash-cta");
      a.removeAttribute("target");
    });
  });

  return doc.documentElement.outerHTML;
}

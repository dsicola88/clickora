/** Âncoras típicas de CTA na sales page (ex. Neotonics `#order-now`). */
export function isCommerceHashHref(href: string): boolean {
  const h = (href || "").trim().toLowerCase();
  if (!h.startsWith("#") || h.length < 2) return false;
  return /^#(?:order|buy|checkout|cta|offer|cart|purchase|shop|bundle|package|pricing)(?:[-_a-z0-9]*)?$/i.test(h);
}

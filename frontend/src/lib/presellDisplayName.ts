/** Código curto da página de origem, por exemplo "PV V2". Não é o nome do produto. */
export function looksLikeVariantCode(value: string): boolean {
  const t = value.trim();
  if (!t || t.length > 18) return false;
  if (/^pv\b/i.test(t)) return true;
  return /^[A-Za-z]{1,6}(?:\s+[A-Za-z]?\d+|\s*v\d+)$/i.test(t);
}

/** "Visivra2" → "Visivra". Um nome sem dígito final fica igual. */
export function brandFromPageTitle(pageTitle: string): string {
  const t = pageTitle.trim();
  const m = t.match(/^(.+?[A-Za-z])\d+$/);
  if (m && m[1].replace(/\s/g, "").length >= 4) return m[1].trim();
  return t;
}

export function presellHeadline(opts: {
  importedClone: boolean;
  productName: string;
  contentTitle: string;
  pageTitle: string;
}): string {
  const stored = (opts.productName || opts.contentTitle || "").trim();
  const pageTitle = opts.pageTitle.trim();
  if (opts.importedClone && looksLikeVariantCode(stored) && pageTitle) {
    return brandFromPageTitle(pageTitle);
  }
  if (opts.importedClone) return stored || opts.contentTitle.trim() || pageTitle;
  return opts.contentTitle.trim() || pageTitle;
}

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
    return brandFromPageTitle(splitBrandFromSeoTitle(pageTitle));
  }
  if (opts.importedClone) return stored || opts.contentTitle.trim() || pageTitle;
  return opts.contentTitle.trim() || pageTitle;
}

/** Primeiro segmento de títulos SEO tipo «LungOra | Official Site». */
export function splitBrandFromSeoTitle(title: string): string {
  const t = title.trim();
  if (!t) return "";
  const parts = t.split(/\s*[-–|]\s*/);
  const first = (parts[0]?.trim() || t).replace(/[™®©]/g, "").trim();
  const genericSecond =
    /^(text presentation|official site|official website|home|welcome|support .+|shop)$/i;
  if (parts.length >= 2 && genericSecond.test(parts[1]?.trim() || "")) {
    return first;
  }
  return first;
}

/** Nome legível no header do portal black (evita códigos tipo PV / PV V2). */
export function resolvePresellPortalBrandName(args: {
  productName?: string;
  contentTitle?: string;
  sourcePageTitle?: string;
  pageTitle?: string;
}): string {
  const productName = (args.productName || "").trim();
  const contentTitle = (args.contentTitle || "").trim();
  const sourcePageTitle = (args.sourcePageTitle || "").trim();
  const pageTitle = (args.pageTitle || "").trim();
  const stored = productName || contentTitle;

  const seoCandidates = [sourcePageTitle, pageTitle]
    .map(splitBrandFromSeoTitle)
    .map(brandFromPageTitle)
    .filter((b) => b.length >= 3 && !looksLikeVariantCode(b));

  if (looksLikeVariantCode(stored) && seoCandidates[0]) {
    return seoCandidates[0];
  }

  const headline = presellHeadline({
    importedClone: Boolean(sourcePageTitle || pageTitle),
    productName: stored,
    contentTitle,
    pageTitle: sourcePageTitle || pageTitle,
  });
  const cleaned = brandFromPageTitle(splitBrandFromSeoTitle(headline));
  if (cleaned && !looksLikeVariantCode(cleaned)) return cleaned;
  if (seoCandidates[0]) return seoCandidates[0];
  return stored || pageTitle || "Produto";
}

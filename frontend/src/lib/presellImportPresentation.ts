export const PRESSELL_IMPORT_PRESENTATIONS = ["mirror", "essentials"] as const;
export type PresellImportPresentation = (typeof PRESSELL_IMPORT_PRESENTATIONS)[number];

export function normalizePresellImportPresentation(raw: unknown): PresellImportPresentation | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "mirror" || v === "essentials") return v;
  return null;
}

/** Só essencial (estilo SuperPresell): imagem, título, copy resumida — sem HTML clonado. */
export function isEssentialsImportPresentation(content: Record<string, unknown> | null | undefined): boolean {
  const c = content && typeof content === "object" ? content : {};
  return normalizePresellImportPresentation(c.importPresentation ?? c.import_presentation) === "essentials";
}

/** Espelho 1:1 da sales page (modo white clássico). */
export function isMirrorImportPresentation(content: Record<string, unknown> | null | undefined): boolean {
  const c = content && typeof content === "object" ? content : {};
  const norm = normalizePresellImportPresentation(c.importPresentation ?? c.import_presentation);
  if (norm === "essentials") return false;
  return norm === "mirror" || norm === null;
}

/** Valor efectivo ao editar (white sem flag + sem espelho → essentials). */
export function resolveImportPresentationFromContent(
  content: Record<string, unknown> | null | undefined,
  niche: "black" | "white",
): PresellImportPresentation | null {
  if (niche !== "white") return null;
  const norm = normalizePresellImportPresentation(
    (content && typeof content === "object" ? content : {}).importPresentation ??
      (content && typeof content === "object" ? content : {}).import_presentation,
  );
  if (norm) return norm;
  const mirrorLen = String(
    (content?.importMirrorSrcDoc ?? content?.import_mirror_src_doc ?? "") as string,
  ).trim().length;
  return mirrorLen >= 800 ? "mirror" : "essentials";
}

export type EssentialsImportFields = {
  title?: string;
  subtitle?: string;
  salesText?: string;
  ctaText?: string;
  productName?: string;
  productImages?: string[];
  sourceUrl?: string;
  affiliateLink?: string;
  storefrontTheme?: string;
  storefrontHeroTint?: boolean;
  importMode?: string;
};

/** Campos extraídos da oferta — sem espelho HTML. */
export function essentialsFieldsFromImport(
  data: Record<string, unknown>,
  opts?: { isDiscount?: boolean },
): EssentialsImportFields {
  const isDiscount = opts?.isDiscount === true;
  return {
    title: String(data.title ?? data.product_name ?? "").trim() || undefined,
    subtitle: String(data.subtitle ?? "").trim() || undefined,
    salesText: String(data.sales_text ?? "").trim() || undefined,
    ctaText: String(isDiscount ? data.official_buy_cta : data.cta_text ?? "").trim() || undefined,
    productName: String(data.product_name ?? data.title ?? "").trim() || undefined,
    productImages: Array.isArray(data.images) ? data.images.filter((x) => typeof x === "string") : undefined,
    sourceUrl: String(data.source_url ?? "").trim() || undefined,
    affiliateLink: String(data.affiliate_link ?? "").trim() || undefined,
    storefrontTheme: typeof data.storefront_theme === "string" ? data.storefront_theme : undefined,
    storefrontHeroTint: data.storefront_hero_tint === true,
    importMode: "template",
  };
}

export const IMPORT_PRESENTATION_OPTIONS = [
  {
    id: "essentials",
    nameKey: "pages.createPresell.importPresentationEssentials",
    descriptionKey: "pages.createPresell.importPresentationEssentialsHint",
  },
  {
    id: "mirror",
    nameKey: "pages.createPresell.importPresentationMirror",
    descriptionKey: "pages.createPresell.importPresentationMirrorHint",
  },
] as const;
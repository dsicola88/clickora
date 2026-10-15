/**
 * Artigo editorial transparente — sem bridge de preço e sem alegações
 * de saúde inventadas (bloqueio típico no Google Ads).
 */

import { HEALTH_ARTICLE_PACKS } from "./presellHealthArticle.locales";
import { normalizePresellLocale } from "./presellUiStrings";

export type HealthArticlePillar = { title: string; body: string };

export type HealthArticle = {
  kicker: string;
  headline: string;
  intro: string;
  pillarsTitle: string;
  pillars: HealthArticlePillar[];
  productNote: string;
  ctaLabel: string;
};

const BRIDGE_JUNK =
  /price written on the offer page|see today's offer|see the offer|the current price is on the next page|the product name and the pictures are ready|before you continue|on the next page|from the offer page|preço escrito na página|veja a oferta de hoje|o preço atual está na página seguinte/i;

/** Claims médicos / benefícios inventados — não gerar automaticamente. */
const INVENTED_HEALTH =
  /carotenoides|mácula|macula|luz azul|fadiga ocular|visão noturna|antioxidante|nutrição ocular|cura|milagroso|garantido|fda\s*approved/i;

export function isThinBridgeSalesText(salesText: string | null | undefined): boolean {
  const t = (salesText || "").trim();
  if (!t) return true;
  if (BRIDGE_JUNK.test(t)) return true;
  const uniqueLines = new Set(
    t
      .split(/\n/)
      .map((l) => l.replace(/^[•*\-]\s*/, "").trim().toLowerCase())
      .filter((l) => l.length > 12),
  );
  return uniqueLines.size > 0 && uniqueLines.size <= 4 && t.length < 420;
}

const FALLBACK_PRODUCT_NAME: Record<ReturnType<typeof normalizePresellLocale>, string> = {
  en: "this product",
  es: "este producto",
  "pt-BR": "este produto",
  de: "dieses Produkt",
  fr: "ce produit",
  it: "questo prodotto",
  pl: "ten produkt",
  tr: "bu ürün",
  hi: "यह उत्पाद",
  ar: "هذا المنتج",
  nl: "dit product",
  sv: "denna produkt",
  no: "dette produktet",
  da: "dette produkt",
};

function fillName(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

/**
 * Artigo portal no idioma da página: só factos verificáveis sobre o papel da página.
 * Não inventa composição, benefícios clínicos nem “especialistas”.
 */
export function buildHealthPortalArticle(productName: string, language: string | undefined): HealthArticle {
  const locale = normalizePresellLocale(language);
  const pack = HEALTH_ARTICLE_PACKS[locale];
  const safeName = productName.trim() || FALLBACK_PRODUCT_NAME[locale];
  return {
    kicker: pack.kicker,
    headline: fillName(pack.headline, safeName),
    intro: fillName(pack.intro, safeName),
    pillarsTitle: pack.pillarsTitle,
    pillars: pack.pillars.map((p) => ({ title: p.title, body: p.body })),
    productNote: fillName(pack.productNote, safeName),
    ctaLabel: pack.ctaLabel,
  };
}

/** Compatível com o template português já usado nos testes. */
export function buildPtBrHealthPortalArticle(productName: string): HealthArticle {
  return buildHealthPortalArticle(productName, "pt-BR");
}

export function healthArticleToSalesText(article: HealthArticle): string {
  const pillars = article.pillars.map((p) => `${p.title}\n${p.body}`).join("\n\n");
  return `${article.headline}

${article.intro}

${article.pillarsTitle}

${pillars}

${article.productNote}`.trim();
}

type ContentLike = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function pillarsFromContent(raw: unknown): HealthArticlePillar[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: HealthArticlePillar[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = asString(row.title);
    const body = asString(row.body || row.text);
    if (title && body) out.push({ title, body });
  }
  return out.length ? out : null;
}

function looksInventedHealthCopy(...parts: string[]): boolean {
  return parts.some((p) => INVENTED_HEALTH.test(p));
}

/**
 * Resolve o artigo. Bridge antiga ou copy com claims inventados → template transparente.
 * Campos estruturados só entram se não tiverem alegações médicas fabricadas.
 */
export function resolveHealthArticle(args: {
  content: ContentLike;
  productName: string;
  language: string;
  salesText?: string;
  ctaText?: string;
}): HealthArticle {
  const c = args.content;
  const pillars = pillarsFromContent(c.articlePillars || c.healthPillars);
  const headline = asString(c.articleHeadline || c.healthHeadline);
  const intro = asString(c.articleIntro || c.healthIntro);
  const pillarsTitle = asString(c.articlePillarsTitle || c.healthPillarsTitle);
  const productNote = asString(c.articleProductNote || c.healthProductNote);
  const base = buildHealthPortalArticle(args.productName, args.language);

  const structuredOk =
    headline &&
    intro &&
    pillars &&
    pillars.length >= 2 &&
    !looksInventedHealthCopy(
      headline,
      intro,
      pillarsTitle,
      productNote,
      ...pillars.map((p) => `${p.title} ${p.body}`),
    );

  if (structuredOk && pillars) {
    return {
      kicker: base.kicker,
      headline,
      intro,
      pillarsTitle: pillarsTitle || base.pillarsTitle,
      pillars,
      productNote: productNote || base.productNote,
      ctaLabel: pickCta(args.ctaText, base.ctaLabel),
    };
  }

  const sales = args.salesText || asString(c.salesText || c.sales_text);
  if (
    isThinBridgeSalesText(sales) ||
    looksInventedHealthCopy(sales) ||
    /^(pt|pt-br)/i.test(args.language || "pt")
  ) {
    return { ...base, ctaLabel: pickCta(args.ctaText, base.ctaLabel) };
  }

  const cleaned = sales.replace(BRIDGE_JUNK, "").replace(/\$\d+(?:[.,]\d+)?/g, "").trim();
  if (cleaned.length > 280 && !looksInventedHealthCopy(cleaned)) {
    const parts = cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    return {
      ...base,
      headline: parts[0]?.length < 120 ? parts[0] : base.headline,
      intro: parts.find((p) => p.length > 80 && p !== parts[0]) || base.intro,
      productNote: parts[parts.length - 1] || base.productNote,
      ctaLabel: pickCta(args.ctaText, base.ctaLabel),
    };
  }
  return { ...base, ctaLabel: pickCta(args.ctaText, base.ctaLabel) };
}

function pickCta(raw: string | undefined, fallback: string): string {
  const cta = asString(raw);
  if (!cta) return fallback;
  if (BRIDGE_JUNK.test(cta) || /^see the offer$/i.test(cta)) return fallback;
  if (/fabricante oficial|official manufacturer|somos o fabricante/i.test(cta)) return fallback;
  return cta;
}

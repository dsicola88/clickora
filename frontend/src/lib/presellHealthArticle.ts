/**
 * Artigo informativo estilo portal de saúde — substitui a bridge page
 * (bullets robóticos + preço solto) que o Google Ads rejeita.
 */

export type HealthArticlePillar = { title: string; body: string };

export type HealthArticle = {
  headline: string;
  intro: string;
  pillarsTitle: string;
  pillars: HealthArticlePillar[];
  productNote: string;
  ctaLabel: string;
};

const BRIDGE_JUNK =
  /price written on the offer page|see today's offer|see the offer|the current price is on the next page|the product name and the pictures are ready|before you continue|on the next page|from the offer page|preço escrito na página|veja a oferta de hoje|o preço atual está na página seguinte/i;

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

/** Artigo portal PT-BR (formato Ads-safe: conteúdo informativo + CTA transparente). */
export function buildPtBrHealthPortalArticle(productName: string): HealthArticle {
  const name = productName.trim() || "o produto";
  return {
    headline: "Nutrição Ocular: A Importância dos Carotenoides na Era das Telas Digitais",
    intro:
      "Passamos grande parte do nosso dia expostos à luz azul gerada por smartphones, computadores e televisores. Especialistas apontam que essa rotina intensiva exige cuidados nutricionais específicos para apoiar o conforto visual e mitigar a fadiga ocular ao fim do dia.",
    pillarsTitle: "Pilares do Bem-Estar Ocular",
    pillars: [
      {
        title: "Suporte contra a Fadiga Diária",
        body: "Auxilia a reduzir o impacto do cansaço visual provocado pelo uso prolongado de telas.",
      },
      {
        title: "Ação Antioxidante",
        body: "Fornece nutrientes essenciais que ajudam a proteger as células da mácula contra o envelhecimento precoce.",
      },
      {
        title: "Nutrição Vitamínica Completa",
        body: "Aporte focado de vitaminas que colaboram com a manutenção saudável da visão noturna.",
      },
    ],
    productNote: `Para quem busca uma alternativa concentrada para complementar a dieta com esses nutrientes, a linha internacional ${name} destaca-se pela seleção rigorosa de ingredientes. Como este portal atua de forma independente na recomendação de bem-estar, direcionamos você diretamente para a estrutura oficial do fabricante.`,
    ctaLabel: "Visitar o Site Oficial do Fabricante",
  };
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

/**
 * Resolve o artigo a mostrar. Bridge antiga → template portal PT-BR.
 * Campos estruturados no content têm prioridade.
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

  if (headline && intro && pillars && pillars.length >= 2) {
    const base = buildPtBrHealthPortalArticle(args.productName);
    return {
      headline,
      intro,
      pillarsTitle: pillarsTitle || base.pillarsTitle,
      pillars,
      productNote: productNote || base.productNote,
      ctaLabel:
        asString(args.ctaText) && !/see the offer|ver a oferta|allow/i.test(String(args.ctaText))
          ? String(args.ctaText).trim()
          : base.ctaLabel,
    };
  }

  const sales = args.salesText || asString(c.salesText || c.sales_text);
  if (isThinBridgeSalesText(sales) || /^(pt|pt-br)/i.test(args.language || "pt")) {
    const article = buildPtBrHealthPortalArticle(args.productName);
    const cta = asString(args.ctaText);
    if (cta && !BRIDGE_JUNK.test(cta) && !/^see the offer$/i.test(cta)) {
      return { ...article, ctaLabel: cta };
    }
    return article;
  }

  // Fallback: artigo mínimo a partir do salesText existente (sem preços).
  const cleaned = sales.replace(BRIDGE_JUNK, "").replace(/\$\d+(?:[.,]\d+)?/g, "").trim();
  const article = buildPtBrHealthPortalArticle(args.productName);
  if (cleaned.length > 280) {
    const parts = cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    return {
      ...article,
      headline: parts[0]?.length < 120 ? parts[0] : article.headline,
      intro: parts.find((p) => p.length > 80 && p !== parts[0]) || article.intro,
      productNote: parts[parts.length - 1] || article.productNote,
    };
  }
  return article;
}

/**
 * Gera copy de review para presell (IA opcional + fallback determinístico).
 * Estrutura editorial (headline/intro/pilares) para o portal público — não inventa cura,
 * fabricante oficial, preços inventados nem testemunhos.
 */

export type PresellCopyAngle = "landing" | "review" | "advertorial";

export type PresellArticleBlocks = {
  kicker: string;
  headline: string;
  intro: string;
  pillarsTitle: string;
  pillars: Array<{ title: string; body: string }>;
  productNote: string;
  ctaLabel: string;
};

export type PresellReviewCopyInput = {
  productName: string;
  language: string;
  offerFacts?: string;
  sourceUrl?: string | null;
  priceMention?: string | null;
  /** Ângulo do pacote de 3 variantes. Default review. */
  angle?: PresellCopyAngle;
  /** black = portal informativo Ads-safe; white = página de produto / review limpa. */
  generationNiche?: "black" | "white";
};

export type PresellReviewCopyResult = {
  title: string;
  subtitle: string;
  salesText: string;
  article: PresellArticleBlocks;
  source: "llm" | "deterministic";
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
};

const FORBIDDEN =
  /\b(cura\s+garantida|cure\s+guaranteed|fabricante\s+oficial|official\s+manufacturer|FDA\s+approved\s+cure|milagroso|miracle\s+cure|100%\s+safe|resultado\s+garantido)\b/i;

function normalizeLang(language: string): string {
  const l = (language || "en").trim().toLowerCase();
  if (l.startsWith("pt")) return "pt-BR";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("fr")) return "fr";
  return "en";
}

/**
 * Evita re-injectar artigo editorial reciclado, pitch de vendas ou copy de marketing
 * genérico como «factos da oferta» (ex.: dumps EN numa página PT).
 * Factos úteis = extracto curto e descritivo (ingredientes, formato, preço).
 */
export function sanitizeOfferFacts(raw: string | null | undefined): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (
    /conteúdo informativo independente|independent informational content|como avaliar a oferta|how to review the .+ offer with transparency|portal informativo|análise independente|informação para decidir com transparência|transparent affiliate page|we are not the manufacturer|não somos o fabricante|decisão clara —|editorial tone|tom editorial|página de decisão|decision page|scientists discover|root cause of aging|cura|milagre|miracle cure|cell turnover|shinier and tighter|fine line|look younger|anti-?aging formula|breakthrough formula|clinically proven to|guaranteed results|limited time offer|\border now\b|\bbuy now\b|\bact now\b|as seen on|this essential process/i.test(
      t,
    )
  ) {
    return "";
  }
  // Prosa longa de landing da oferta ≠ factos — só aceita extracto curto.
  if (t.length > 280) {
    const first = (t.split(/(?<=[.!?])\s+/)[0] || "").trim();
    if (
      first.length >= 20 &&
      first.length <= 180 &&
      !/cell turnover|shinier|miracle|cura|order now|buy now/i.test(first)
    ) {
      return first;
    }
    return "";
  }
  return t.slice(0, 280);
}

export function articleBlocksToSalesText(article: PresellArticleBlocks): string {
  const pillars = article.pillars.map((p) => `${p.title}\n${p.body}`).join("\n\n");
  return `${article.headline}\n\n${article.intro}\n\n${article.pillarsTitle}\n\n${pillars}\n\n${article.productNote}`.trim();
}

function packResult(
  article: PresellArticleBlocks,
  subtitle: string,
  meta: Pick<PresellReviewCopyResult, "source" | "model" | "tokensIn" | "tokensOut" | "error">,
): PresellReviewCopyResult {
  return {
    title: article.headline.slice(0, 160),
    subtitle: subtitle.slice(0, 240),
    salesText: articleBlocksToSalesText(article),
    article,
    ...meta,
  };
}

function buildPtArticle(
  name: string,
  angle: PresellCopyAngle,
  facts: string,
  price: string,
): { article: PresellArticleBlocks; subtitle: string } {
  const priceLine = price
    ? ` Preço referido na origem (reconfirme sempre no checkout): ${price}.`
    : "";
  const factsLine = facts
    ? ` Com base na oferta pública: ${facts}`
    : " Sem extracto detalhado da origem — use o site do vendedor como fonte primária.";

  if (angle === "landing") {
    const article: PresellArticleBlocks = {
      kicker: "Página de decisão",
      headline: `${name}: o que confirmar antes de comprar`,
      intro: `${name} é apresentado aqui por um afiliado independente. O objectivo é ajudar a decidir com calma — não substituir a ficha, o rótulo nem o atendimento do vendedor.${factsLine}${priceLine}`,
      pillarsTitle: "Checklist rápido",
      pillars: [
        {
          title: "Identidade e contacto",
          body: "Confirme o nome comercial, e-mail/suporte e políticas publicadas no destino antes de pagar.",
        },
        {
          title: "Preço, envio e devolução",
          body: "Valores e prazos só são válidos no checkout oficial. Compare com o que o anúncio prometeu.",
        },
        {
          title: "Segurança do pagamento",
          body: "Verifique HTTPS e se o domínio de pagamento corresponde à marca anunciada.",
        },
      ],
      productNote: `Podemos receber comissão se continuar pelo link rastreado — sem custo extra. Esta página não promete resultados médicos, financeiros nem milagres.`,
      ctaLabel: "Continuar para a página oficial da oferta",
    };
    return { article, subtitle: "Decisão clara — não somos o fabricante." };
  }

  if (angle === "advertorial") {
    const article: PresellArticleBlocks = {
      kicker: "Artigo de afiliado",
      headline: `O que vale a pena saber sobre ${name}`,
      intro: `Em mercados saturados de anúncios, ${name} aparece com frequência. Este artigo resume critérios de um comprador prudente — sem se passar pelo fabricante.${factsLine}${priceLine}`,
      pillarsTitle: "Critérios editoriais",
      pillars: [
        {
          title: "Clareza da oferta",
          body: "A landing e o anúncio devem dizer a mesma coisa. Divergências são sinal para parar e reler o destino.",
        },
        {
          title: "Rastreabilidade do pagamento",
          body: "Quem cobra, onde está o suporte e qual a política de reembolso — tudo no site do comerciante.",
        },
        {
          title: "Ausência de absolutos nesta página",
          body: "Esta página evita promessas médicas absolutas. Confirme composição e avisos só na origem.",
        },
      ],
      productNote: `Link de afiliado pode gerar comissão. Conteúdo informativo — não substitui aconselhamento profissional.`,
      ctaLabel: "Abrir a oferta oficial e confirmar condições",
    };
    return { article, subtitle: "Tom editorial — factos a confirmar na origem." };
  }

  const article: PresellArticleBlocks = {
    kicker: "Análise independente",
    headline: `Como avaliar a oferta de ${name} com transparência`,
    intro: `Esta página é conteúdo informativo independente sobre ${name}. Não somos o fabricante, não processamos pagamentos e não substituímos a ficha técnica nem o atendimento do vendedor.${factsLine}${priceLine}`,
    pillarsTitle: "O que deve confirmar no site oficial",
    pillars: [
      {
        title: "Identidade do vendedor",
        body: "Confirme o nome comercial, contacto e políticas publicadas no destino da oferta antes de concluir qualquer compra.",
      },
      {
        title: "Preço, envio e garantia",
        body: "Valores, prazos, devoluções e condições de pagamento só são válidos quando apresentados no checkout oficial do comerciante.",
      },
      {
        title: "Composição e avisos do produto",
        body: "Ingredientes, modo de uso e avisos devem ser lidos na página e no rótulo do fabricante — esta página não reproduz nem inventa essas informações.",
      },
    ],
    productNote: `Se quiser conhecer a proposta comercial de ${name}, utilize o botão abaixo. Podemos receber comissão por indicação — sem custo adicional para si.`,
    ctaLabel: "Continuar para a página oficial da oferta",
  };
  return { article, subtitle: "Informação para decidir com transparência — não somos o fabricante." };
}

function buildEnArticle(
  name: string,
  angle: PresellCopyAngle,
  facts: string,
  price: string,
): { article: PresellArticleBlocks; subtitle: string } {
  const priceLine = price ? ` Price mentioned at the source (re-check at checkout): ${price}.` : "";
  const factsLine = facts
    ? ` From the public offer: ${facts}`
    : " No detailed extract — treat the seller site as the primary source.";

  if (angle === "landing") {
    const article: PresellArticleBlocks = {
      kicker: "Decision page",
      headline: `${name}: what to confirm before you buy`,
      intro: `${name} is presented here by an independent affiliate. The goal is a calm decision — not to replace the seller’s specs, label, or support.${factsLine}${priceLine}`,
      pillarsTitle: "Quick checklist",
      pillars: [
        {
          title: "Identity & contact",
          body: "Confirm the business name, support channel, and published policies before paying.",
        },
        {
          title: "Price, shipping & returns",
          body: "Only the official checkout is authoritative. Compare it with what the ad promised.",
        },
        {
          title: "Checkout security",
          body: "Check HTTPS and that the payment domain matches the advertised brand.",
        },
      ],
      productNote: `We may earn a commission via the tracked link at no extra cost. This page does not promise medical, financial, or miracle results.`,
      ctaLabel: "Continue to the official offer page",
    };
    return { article, subtitle: "Clear decision page — we are not the manufacturer." };
  }

  if (angle === "advertorial") {
    const article: PresellArticleBlocks = {
      kicker: "Affiliate article",
      headline: `What to know about ${name}`,
      intro: `In crowded ad markets, ${name} shows up often. This piece outlines what a careful buyer should verify — without posing as the manufacturer.${factsLine}${priceLine}`,
      pillarsTitle: "Editorial criteria",
      pillars: [
        {
          title: "Offer clarity",
          body: "The ad and the landing should say the same thing. Gaps are a reason to pause.",
        },
        {
          title: "Payment traceability",
          body: "Who charges, where support lives, and what the refund policy says — all on the merchant site.",
        },
        {
          title: "No absolute claims here",
          body: "We do not claim cures, miracles, or guaranteed outcomes. Confirm composition and warnings only at the source.",
        },
      ],
      productNote: `Affiliate links may earn a commission. Informational content — not professional advice.`,
      ctaLabel: "Open the official offer and confirm terms",
    };
    return { article, subtitle: "Editorial tone — facts to confirm at the source." };
  }

  const article: PresellArticleBlocks = {
    kicker: "Independent analysis",
    headline: `How to review the ${name} offer with transparency`,
    intro: `This page is independent informational content about ${name}. We are not the manufacturer, we do not process payments, and we do not replace the seller’s label or support.${factsLine}${priceLine}`,
    pillarsTitle: "What to confirm on the official site",
    pillars: [
      {
        title: "Seller identity",
        body: "Confirm the business name, contact details, and published policies before buying.",
      },
      {
        title: "Price, shipping & warranty",
        body: "Only the merchant checkout is authoritative for price, delivery, and returns.",
      },
      {
        title: "Product details & warnings",
        body: "Read composition and warnings on the seller page and label — this page does not invent them.",
      },
    ],
    productNote: `We may earn a commission if you continue via the tracked link, at no extra cost to you.`,
    ctaLabel: "Continue to the official offer page",
  };
  return { article, subtitle: "Transparent affiliate page — we are not the manufacturer." };
}

export function buildDeterministicReviewCopy(input: PresellReviewCopyInput): PresellReviewCopyResult {
  const name = (input.productName || "Product").trim().slice(0, 120) || "Product";
  const lang = normalizeLang(input.language);
  const facts = sanitizeOfferFacts(input.offerFacts);
  const price = (input.priceMention || "").trim().slice(0, 40);
  const angle: PresellCopyAngle = input.angle || "review";

  if (lang === "pt-BR") {
    const { article, subtitle } = buildPtArticle(name, angle, facts, price);
    return packResult(article, subtitle, {
      source: "deterministic",
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      error: null,
    });
  }

  if (lang === "es") {
    const article: PresellArticleBlocks = {
      kicker: angle === "advertorial" ? "Artículo de afiliado" : angle === "landing" ? "Página de decisión" : "Análisis independiente",
      headline:
        angle === "landing"
          ? `${name}: qué confirmar antes de comprar`
          : angle === "advertorial"
            ? `Qué conviene saber sobre ${name}`
            : `Cómo evaluar la oferta de ${name} con transparencia`,
      intro: `Esta página es contenido informativo independiente sobre ${name}. No somos el fabricante ni procesamos pagos.${facts ? ` Resumen público: ${facts}` : ""}${price ? ` Precio en origen (reconfirme): ${price}.` : ""}`,
      pillarsTitle: "Qué confirmar en el sitio oficial",
      pillars: [
        { title: "Identidad del vendedor", body: "Nombre comercial, contacto y políticas publicadas en el destino." },
        { title: "Precio, envío y devoluciones", body: "Solo el checkout oficial es válido." },
        { title: "Avisos del producto", body: "Lea composición y advertencias en la ficha del vendedor." },
      ],
      productNote: "Podemos recibir comisión por el enlace de afiliado. No prometemos milagros ni resultados garantizados.",
      ctaLabel: "Continuar a la página oficial de la oferta",
    };
    return packResult(article, "Contenido de afiliado transparente — no somos el fabricante.", {
      source: "deterministic",
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      error: null,
    });
  }

  const { article, subtitle } = buildEnArticle(name, angle, facts, price);
  return packResult(article, subtitle, {
    source: "deterministic",
    model: null,
    tokensIn: 0,
    tokensOut: 0,
    error: null,
  });
}

function sanitizeGenerated(text: string): string {
  const t = text.replace(/\0/g, "").trim();
  if (FORBIDDEN.test(t)) {
    return t
      .replace(FORBIDDEN, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return t;
}

type LlmArticleJson = {
  kicker?: string;
  headline?: string;
  intro?: string;
  pillars_title?: string;
  pillars?: Array<{ title?: string; body?: string }>;
  product_note?: string;
  cta_label?: string;
};

type LlmJson = {
  title?: string;
  subtitle?: string;
  sales_text?: string;
  salesText?: string;
  article?: LlmArticleJson;
};

function articleFromLlm(raw: LlmArticleJson | undefined, fallback: PresellArticleBlocks): PresellArticleBlocks {
  if (!raw || typeof raw !== "object") return fallback;
  const pillars = Array.isArray(raw.pillars)
    ? raw.pillars
        .map((p) => ({
          title: sanitizeGenerated(String(p?.title || "").trim()).slice(0, 120),
          body: sanitizeGenerated(String(p?.body || "").trim()).slice(0, 600),
        }))
        .filter((p) => p.title && p.body)
    : [];
  const intro = sanitizeGenerated(String(raw.intro || "").trim());
  const headline = sanitizeGenerated(String(raw.headline || "").trim()).slice(0, 160);
  if (!headline || intro.length < 40 || pillars.length < 2) return fallback;
  return {
    kicker: sanitizeGenerated(String(raw.kicker || fallback.kicker).trim()).slice(0, 60) || fallback.kicker,
    headline,
    intro: intro.slice(0, 1200),
    pillarsTitle:
      sanitizeGenerated(String(raw.pillars_title || fallback.pillarsTitle).trim()).slice(0, 120) ||
      fallback.pillarsTitle,
    pillars: pillars.slice(0, 5),
    productNote:
      sanitizeGenerated(String(raw.product_note || fallback.productNote).trim()).slice(0, 500) ||
      fallback.productNote,
    ctaLabel:
      sanitizeGenerated(String(raw.cta_label || fallback.ctaLabel).trim()).slice(0, 80) || fallback.ctaLabel,
  };
}

export async function generatePresellReviewCopy(
  input: PresellReviewCopyInput,
): Promise<PresellReviewCopyResult> {
  const fallback = buildDeterministicReviewCopy(input);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const lang = normalizeLang(input.language);
  const angle: PresellCopyAngle = input.angle || "review";
  const niche = input.generationNiche === "white" ? "white" : "black";
  const model = "gpt-4o-mini";
  const angleHint =
    angle === "landing"
      ? "Decision landing: short editorial sections + checklist."
      : angle === "advertorial"
        ? "Advertorial/article tone (journalistic, honest affiliate)."
        : "Independent review analysis with clear verification pillars.";
  const nicheHint =
    niche === "black"
      ? "Niche BLACK: informational portal for paid Search — do NOT clone aggressive sales-page claims; help the reader verify facts on the official site."
      : "Niche WHITE: clean product/review page — closer to the offer look, still honest affiliate (no manufacturer pose).";
  const system = `You write professional affiliate editorial pages for Google Ads policy awareness.
Angle: ${angle}. ${angleHint}
${nicheHint}
Rules:
- Sound like a careful publisher + affiliate, not a spam bridge.
- Never claim to be the manufacturer or official store.
- No medical cures, guaranteed results, miracle language, or invented testimonials/prices.
- Brief affiliate disclosure in product_note.
- Write entirely in language code: ${lang}.
- Return JSON only with keys: title, subtitle, article:{kicker,headline,intro,pillars_title,pillars:[{title,body}],product_note,cta_label}.
- article.intro >= 60 words when possible; exactly 3 pillars; no invented clinical benefits.
- Ignore marketing hype in offer_facts; only use short factual product cues.`;

  const user = JSON.stringify({
    product_name: input.productName,
    language: lang,
    angle,
    generation_niche: niche,
    offer_facts: sanitizeOfferFacts(input.offerFacts).slice(0, 400),
    source_url: input.sourceUrl || null,
    price_mention: input.priceMention || null,
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.35,
        max_tokens: 1600,
      }),
    });
    if (!res.ok) {
      return { ...fallback, error: `OpenAI ${res.status}` };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as LlmJson;
    const article = articleFromLlm(parsed.article, fallback.article);
    const subtitle = sanitizeGenerated(String(parsed.subtitle || fallback.subtitle).trim()).slice(0, 240);
    const salesText = articleBlocksToSalesText(article);
    if (salesText.split(/\s+/).filter(Boolean).length < 80) {
      return { ...fallback, error: "llm_thin_output" };
    }
    return {
      title: article.headline.slice(0, 160),
      subtitle: subtitle || fallback.subtitle,
      salesText,
      article,
      source: "llm",
      model: `openai/${model}`,
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
      error: null,
    };
  } catch (e) {
    return {
      ...fallback,
      error: e instanceof Error ? e.message.slice(0, 200) : "llm_error",
    };
  }
}

export type TriplePackCopy = {
  landing: PresellReviewCopyResult;
  review: PresellReviewCopyResult;
  advertorial: PresellReviewCopyResult;
  source: "llm" | "deterministic";
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
};

/** Uma chamada (ou fallback) → 3 ângulos para o pacote landing/review/advertorial. */
export async function generateTriplePackCopy(
  input: Omit<PresellReviewCopyInput, "angle">,
): Promise<TriplePackCopy> {
  const landing = buildDeterministicReviewCopy({ ...input, angle: "landing" });
  const review = buildDeterministicReviewCopy({ ...input, angle: "review" });
  const advertorial = buildDeterministicReviewCopy({ ...input, angle: "advertorial" });
  const fallback: TriplePackCopy = {
    landing,
    review,
    advertorial,
    source: "deterministic",
    model: null,
    tokensIn: 0,
    tokensOut: 0,
    error: null,
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const lang = normalizeLang(input.language);
  const niche = input.generationNiche === "white" ? "white" : "black";
  const model = "gpt-4o-mini";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `Return JSON {"landing":{title,subtitle,article:{...}},"review":{...},"advertorial":{...}}.
article keys: kicker,headline,intro,pillars_title,pillars[{title,body}],product_note,cta_label.
Language: ${lang}. Niche: ${niche}.
${niche === "black" ? "BLACK = informational Ads portal — no aggressive sales clone." : "WHITE = clean product/review page — honest affiliate."}
Affiliate-safe: no manufacturer claims, no cures/miracles, no invented prices/testimonials.
Ignore marketing hype in offer_facts; keep only short factual cues.
Each angle must feel distinct (landing=checklist, review=analysis, advertorial=editorial).`,
          },
          {
            role: "user",
            content: JSON.stringify({
              product_name: input.productName,
              generation_niche: niche,
              offer_facts: sanitizeOfferFacts(input.offerFacts).slice(0, 400),
              source_url: input.sourceUrl || null,
              price_mention: input.priceMention || null,
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.35,
        max_tokens: 3600,
      }),
    });
    if (!res.ok) return { ...fallback, error: `OpenAI ${res.status}` };
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Record<
      string,
      LlmJson | undefined
    >;
    const pick = (key: PresellCopyAngle, fb: PresellReviewCopyResult): PresellReviewCopyResult => {
      const block = parsed[key] || {};
      const article = articleFromLlm(block.article, fb.article);
      const salesText = articleBlocksToSalesText(article);
      if (salesText.split(/\s+/).filter(Boolean).length < 60) return fb;
      return {
        title: article.headline.slice(0, 160),
        subtitle:
          sanitizeGenerated(String(block.subtitle || fb.subtitle).trim()).slice(0, 240) || fb.subtitle,
        salesText,
        article,
        source: "llm",
        model: `openai/${model}`,
        tokensIn: 0,
        tokensOut: 0,
        error: null,
      };
    };
    const outLanding = pick("landing", landing);
    const outReview = pick("review", review);
    const outAdv = pick("advertorial", advertorial);
    const anyLlm =
      outLanding.source === "llm" || outReview.source === "llm" || outAdv.source === "llm";
    return {
      landing: outLanding,
      review: outReview,
      advertorial: outAdv,
      source: anyLlm ? "llm" : "deterministic",
      model: anyLlm ? `openai/${model}` : null,
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
      error: null,
    };
  } catch (e) {
    return {
      ...fallback,
      error: e instanceof Error ? e.message.slice(0, 200) : "llm_error",
    };
  }
}

/** Mapeia texto de reprovação Google → pistas accionáveis (sem LLM obrigatório). */
export function mapDisapprovalToHints(disapprovalText: string): Array<{
  code: string;
  title: string;
  steps: string[];
}> {
  const t = disapprovalText.toLowerCase();
  const out: Array<{ code: string; title: string; steps: string[] }> = [];

  if (/destination|destino|404|not found|unavailable|indispon/.test(t)) {
    out.push({
      code: "destination",
      title: "Destino / URL",
      steps: [
        "Abra a URL do anúncio e da presell no browser — confirme 200 OK.",
        "Na Clickora: Presell → republicar; actualize o anúncio se o slug mudou.",
        "Corra a auditoria de conformidade (probe de destino).",
      ],
    });
  }
  if (/misrepresent|engan|misleading|identity|identidade|affiliation|afiliad/.test(t)) {
    out.push({
      code: "transparency",
      title: "Transparência / identidade",
      steps: [
        "Ligue o rodapé de políticas se estiver desligado, com nome e e-mail reais.",
        "Garanta divulgação de afiliado visível.",
        "Remova linguagem de «site oficial / fabricante».",
      ],
    });
  }
  if (/original content|conteúdo original|thin|bridge|qualidade da página|landing page/.test(t)) {
    out.push({
      code: "content",
      title: "Conteúdo original",
      steps: [
        "Use «Gerar review IA» para corpo substantivo (ou escreva ≥150 palavras úteis).",
        "Evite página só com imagem + botão.",
        "Reaudite até OC-001/OC-002 passarem.",
      ],
    });
  }
  if (/health|saúde|medical|supplement|claim|alegaç/.test(t)) {
    out.push({
      code: "claims",
      title: "Alegações",
      steps: [
        "Remova cura, milagre, resultado garantido e linguagem médica.",
        "Reaudite regras CL-* na conformidade.",
      ],
    });
  }
  if (out.length === 0) {
    out.push({
      code: "generic",
      title: "Revisão geral",
      steps: [
        "Cole o motivo exacto do Google e compare com a auditoria Clickora.",
        "Corrija FAILs críticos, publique de novo e submeta o anúncio.",
        "Se o domínio estiver marcado, teste outro domínio verificado.",
      ],
    });
  }
  return out;
}

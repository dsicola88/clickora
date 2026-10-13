export type PageFactStatus = "confirmed" | "quoted";

export type PageFact = {
  label: string;
  value: string;
  status: PageFactStatus;
};

export type ProductPageFacts = {
  facts: PageFact[];
  missing: string[];
  priceNote?: string;
  guaranteeNote?: string;
  description?: string;
  promotionPercent?: string;
};

const PRICE_RE = /(?:(?:US)?\$|€|£|R\$)\s?\d{1,5}(?:[.,]\d{2})?|\d{1,5}(?:[.,]\d{2})?\s?(?:USD|EUR|GBP|BRL)\b/i;
const GUARANTEE_RE =
  /\b(\d{1,3}\s*(?:day|days|dia|dias)\s*(?:money[-\s]?back|de garantia|garantia)|money[-\s]?back guarantee|garantia de\s+\d{1,3}\s+dias|pol[ií]tica de reembolso|refund policy)\b/i;
const PERCENT_RE = /\b(\d{1,2})\s*%\s*(?:off|desconto|discount)\b/i;
const PERCENT_LOOSE_RE = /\b(\d{1,2})\s*%/;
const OFFER_WORD_RE = /off|desconto|discount|save|poup|ahorr|rabatt|promo|oferta|offer|today|hoje|hoy|oggi/i;
const CTA_RE =
  /\b(buy now|order now|add to cart|shop now|get yours now|comprar agora|adicionar ao carrinho|encomendar agora|quero o desconto)\b/i;
const PAYMENT_RE = /\b(parcela|parcelas|installments?|pagamento|payment|one-time|por m[eê]s|per month|\d+\s*x)\b/i;
const BONUS_RE = /\b(bónus|bonus|bônus)\b/i;

const TRACKED = [
  "Preço",
  "Condições de pagamento",
  "Garantia ou reembolso",
  "Bónus",
  "Chamadas à ação",
  "Benefícios escritos na página",
  "Público-alvo",
  "Problema que o produto resolve",
] as const;

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function htmlToPlainText(html: string): string {
  return decode(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\b(?:alt|aria-label|data-price|data-amount)=["']([^"']+)["']/gi, " $1. ")
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|header|footer)>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(?:\.\s*){2,}/g, ". ")
    .trim();
}

function sentences(text: string): string[] {
  return offerChunks(text).filter((part) => part.length >= 8);
}

function offerChunks(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 2 && part.length <= 180);
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : "";
}

function controlTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = htmlToPlainText(match[1] ?? "");
    if (text && CTA_RE.test(text) && text.length <= 80) out.push(text);
  }
  return [...new Set(out)].slice(0, 4);
}

function listUnderHeading(html: string, heading: RegExp): string[] {
  const blocks = html.split(/<h[1-3]\b[^>]*>/i).slice(1);
  const items: string[] = [];
  for (const block of blocks) {
    const title = htmlToPlainText(block.split(/<\/h[1-3]>/i)[0] ?? "");
    if (!heading.test(title)) continue;
    const lis = block.match(/<li\b[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
    for (const li of lis) {
      const text = htmlToPlainText(li);
      if (text.length >= 8 && text.length <= 90) items.push(text);
    }
  }
  return [...new Set(items)].slice(0, 4);
}

const OTHER_BRAND_STOP = new Set([
  "the", "and", "for", "you", "your", "this", "that", "with", "from", "official", "website", "site",
  "money", "back", "guarantee", "today", "buy", "order", "free", "shipping", "days", "day", "only",
  "just", "get", "save", "special", "discount", "offer", "price", "off", "now", "here", "page",
]);

function mentionsOtherBrand(sentence: string, product: string): boolean {
  const allowed = new Set(
    product
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 3),
  );
  const caps = sentence.match(/\b[A-Z][A-Za-z0-9]{2,}\b/g) ?? [];
  return caps.some((word) => {
    const lower = word.toLowerCase();
    return !allowed.has(lower) && !OTHER_BRAND_STOP.has(lower);
  });
}

/** Pergunta ou frase de outra marca não servem de preço, garantia ou desconto. */
function lineForProduct(line: string, product: string): boolean {
  if (line.includes("?")) return false;
  if (product && mentionsOtherBrand(line, product)) return false;
  return true;
}

function discountPercent(lines: string[], product: string): string {
  for (const line of lines) {
    if (!lineForProduct(line, product)) continue;
    const strict = line.match(PERCENT_RE);
    if (strict?.[1] && strict[1] !== "100") return strict[1];
  }
  for (const line of lines) {
    if (!lineForProduct(line, product)) continue;
    const loose = line.match(PERCENT_LOOSE_RE);
    if (!loose?.[1]) continue;
    const n = Number(loose[1]);
    if (n < 1 || n > 90) continue;
    if (OFFER_WORD_RE.test(line) || line.trim().length <= 12) return loose[1];
  }
  return "";
}

/** Só devolve trechos que existem no texto. Não completa o que a página não diz. */
export function extractProductPageFacts(html: string, product = ""): ProductPageFacts {
  const text = htmlToPlainText(html);
  const lines = sentences(text).filter((line) => lineForProduct(line, product));
  const facts: PageFact[] = [];
  const found = new Set<string>();

  const priceSentence = lines.find((line) => PRICE_RE.test(line));
  const price = priceSentence ? clip(priceSentence, 120) : "";
  if (price) {
    facts.push({ label: "Preço", value: price, status: "confirmed" });
    found.add("Preço");
  }

  const payment = priceSentence && PAYMENT_RE.test(priceSentence) ? price : "";
  if (payment) {
    facts.push({ label: "Condições de pagamento", value: payment, status: "confirmed" });
    found.add("Condições de pagamento");
  }

  const guaranteeSentence = lines.find((line) => GUARANTEE_RE.test(line));
  const guarantee = guaranteeSentence ? clip(guaranteeSentence, 120) : "";
  if (guarantee) {
    facts.push({ label: "Garantia ou reembolso", value: guarantee, status: "confirmed" });
    found.add("Garantia ou reembolso");
  }

  const percent = discountPercent(offerChunks(text), product);
  if (percent) {
    facts.push({ label: "Desconto escrito na página", value: `${percent}%`, status: "confirmed" });
  }

  for (const bonus of lines.filter((line) => BONUS_RE.test(line)).slice(0, 3)) {
    facts.push({ label: "Bónus", value: bonus, status: "quoted" });
    found.add("Bónus");
  }

  for (const cta of controlTexts(html)) {
    facts.push({ label: "Chamadas à ação", value: cta, status: "quoted" });
    found.add("Chamadas à ação");
  }

  for (const benefit of listUnderHeading(html, /benef[ií]cios|features|vantagens/i)) {
    facts.push({ label: "Benefícios escritos na página", value: benefit, status: "quoted" });
    found.add("Benefícios escritos na página");
  }

  const audience = lines.find((line) => /\b(para quem|ideal for|feito para|indicado para)\b/i.test(line));
  if (audience) {
    facts.push({ label: "Público-alvo", value: audience, status: "quoted" });
    found.add("Público-alvo");
  }

  const problem = lines.find((line) => /\b(resolve|problema|problem|struggling with)\b/i.test(line));
  if (problem) {
    facts.push({ label: "Problema que o produto resolve", value: problem, status: "quoted" });
    found.add("Problema que o produto resolve");
  }

  const description = [price, guarantee].filter(Boolean).join(" ").slice(0, 1000);
  return {
    facts,
    missing: TRACKED.filter((label) => !found.has(label)),
    ...(price ? { priceNote: price } : {}),
    ...(guarantee ? { guaranteeNote: guarantee } : {}),
    ...(description ? { description } : {}),
    ...(percent ? { promotionPercent: percent } : {}),
  };
}

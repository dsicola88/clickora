/**
 * Extractor de landing page → sinais reais do produto.
 *
 * Regra de ouro: **só devolvemos o que conseguimos provar** a partir do HTML
 * da página. Não inventamos preços, garantias, certificações nem nada.
 *
 * Fontes priorizadas:
 *  1) JSON-LD `Product` / `Offer` (norma Schema.org / Shopify / WooCommerce)
 *  2) Meta tags Open Graph (`og:title`, `og:description`)
 *  3) `<title>` e `<meta name="description">`
 *  4) Pattern matching no texto visível (regex) para garantia, envio,
 *     certificações, atributos comuns
 *
 * Nada de scraping agressivo; um único GET com timeout, body limit e
 * domínios privados bloqueados.
 */
import type { GoogleProductSignals } from "./google-campaign-ai-shared";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const USER_AGENT =
  "Mozilla/5.0 (compatible; ClickoraDpilot/1.0; +https://clickora.com/dpilot)";

export type LandingExtractResult = {
  ok: true;
  url: string;
  hostname: string;
  language: string | null;
  /** Texto sugerido para o campo "Oferta" (1-3 linhas, derivado de title + description). */
  offer_suggestion: string | null;
  /** Sinais reais detectados — só os que foram **encontrados** explicitamente. */
  signals: GoogleProductSignals;
  /** Origem de cada sinal (debug e UI: "extraído da página x" vs "introduzido por ti"). */
  sources: Record<keyof GoogleProductSignals, string | undefined>;
};

export type LandingExtractError = { ok: false; error: string };

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h === "127.0.0.1" || h.startsWith("127.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("169.254.")) return true;
  if (h.startsWith("192.168.")) return true;
  /** 172.16.0.0/12 -> 172.16. .. 172.31. */
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172) {
    const n = Number(m172[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max).trim();
}

interface ParsedHtml {
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  language: string | null;
  jsonLd: unknown[];
  bodyText: string;
}

function parseHtml(html: string): ParsedHtml {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogTitleMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogDescMatch = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  );
  const langMatch = html.match(/<html[^>]+lang=["']([a-zA-Z-]{2,8})["']/i);

  const jsonLd: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const txt = m[1].trim();
      if (txt) jsonLd.push(JSON.parse(txt));
    } catch {
      /** ignora JSON inválido — landing pode ter scripts mal formados */
    }
  }

  /** Texto visível aproximado para regex de garantia/envio/certificações.
   * Remove <script>/<style>/<noscript> primeiro para evitar ruído. */
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const bodyText = stripTags(cleaned);

  return {
    title: titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : null,
    description: descMatch ? decodeHtmlEntities(descMatch[1]) : null,
    ogTitle: ogTitleMatch ? decodeHtmlEntities(ogTitleMatch[1]) : null,
    ogDescription: ogDescMatch ? decodeHtmlEntities(ogDescMatch[1]) : null,
    language: langMatch ? langMatch[1].toLowerCase() : null,
    jsonLd,
    bodyText,
  };
}

/** Procura recursivamente um nó com `@type === target` num grafo JSON-LD. */
function findNode(node: unknown, target: string): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const it of node) {
      const f = findNode(it, target);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  const matchType =
    (typeof t === "string" && t.toLowerCase() === target.toLowerCase()) ||
    (Array.isArray(t) && t.some((x) => typeof x === "string" && x.toLowerCase() === target.toLowerCase()));
  if (matchType) return obj;
  /** Procura em `@graph` e demais filhos. */
  for (const v of Object.values(obj)) {
    const f = findNode(v, target);
    if (f) return f;
  }
  return null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  BRL: "R$",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF",
  JPY: "¥",
};

function formatPrice(price: unknown, currency: unknown): string | null {
  if (price == null) return null;
  const num = typeof price === "string" ? Number(price.replace(/[^\d.,]/g, "").replace(",", ".")) : Number(price);
  if (!Number.isFinite(num) || num <= 0) return null;
  const cur = typeof currency === "string" ? currency.toUpperCase() : "";
  const sym = CURRENCY_SYMBOLS[cur] ?? (cur ? cur + " " : "");
  /** Mantém 2 decimais quando há cêntimos não-zero. */
  const txt = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return sym ? `${sym}${txt}`.trim() : txt;
}

/** Patterns multilingues — retornam o **primeiro match** preservando o texto literal da página. */
function findFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

function detectGuarantee(text: string): string | null {
  return findFirstMatch(text, [
    /\b\d{1,3}[\s-]*day(?:s)?\s+(?:money[\s-]*back|guarantee)\b/i,
    /\b\d{1,3}[\s-]*dias?\s+(?:de\s+)?garantia\b/i,
    /\bgarantia\s+de\s+\d{1,3}\s+dias?\b/i,
    /\b\d{1,3}\s+d[ií]as\s+(?:de\s+)?garant[íi]a\b/i,
    /\bgarant[íi]a\s+de\s+\d{1,3}\s+d[ií]as\b/i,
    /\b\d{1,3}\s+jours?\s+satisfait/i,
    /\b\d{1,3}[\s-]*Tage\s+Geld[\s-]*zur[üu]ck\b/i,
  ]);
}

function detectShipping(text: string): string | null {
  return findFirstMatch(text, [
    /\bfree\s+(?:us\s+|fast\s+)?shipping\b/i,
    /\bfast\s+shipping\b/i,
    /\benvio\s+gr[áa]tis\b/i,
    /\bfrete\s+gr[áa]tis\b/i,
    /\benv[íi]o\s+gratis\b/i,
    /\blivraison\s+offerte\b/i,
    /\blivraison\s+gratuite\b/i,
    /\bkostenloser?\s+versand\b/i,
  ]);
}

function detectDiscount(text: string): string | null {
  return findFirstMatch(text, [
    /\b\d{1,2}%\s*(?:off|de\s+desconto|de\s+descuento|rabatt|remise|de\s+r[ée]duction)\b/i,
    /\b(?:save|poupe|ahorra|sparen|économisez)\s+\d{1,3}\s*%/i,
    /\b(?:save|poupe|ahorra)\s+(?:up\s+to\s+)?(?:\$|€|£|R\$)\s*\d+/i,
  ]);
}

const KNOWN_CERTIFICATIONS = [
  "FDA Approved",
  "FDA Registered",
  "GMP Certified",
  "GMP Approved",
  "ISO 9001",
  "ISO 22000",
  "CE Certified",
  "USDA Organic",
  "Non-GMO",
  "Vegan Certified",
  "Cruelty-Free",
  "Halal Certified",
  "Kosher Certified",
];

function detectCertifications(text: string): string | null {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const c of KNOWN_CERTIFICATIONS) {
    if (lower.includes(c.toLowerCase()) && !found.includes(c)) found.push(c);
    if (found.length >= 3) break;
  }
  return found.length ? found.join(" & ") : null;
}

const KNOWN_ATTRIBUTES = [
  "100% Organic",
  "100% Natural",
  "Vegan",
  "Gluten-Free",
  "Sugar-Free",
  "Dairy-Free",
  "Plant-Based",
  "Cruelty-Free",
  "Eco-Friendly",
  "Made in USA",
  "Made in Europe",
];

function detectAttributes(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const a of KNOWN_ATTRIBUTES) {
    if (lower.includes(a.toLowerCase()) && !found.includes(a)) found.push(a);
    if (found.length >= 5) break;
  }
  return found;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en;q=0.9,pt;q=0.8,es;q=0.7,de;q=0.6,fr;q=0.5",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} (${res.statusText})`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|xhtml/i.test(ct)) {
      throw new Error(`Conteúdo não é HTML (${ct || "desconhecido"})`);
    }
    /** Lê com limite de bytes para evitar páginas gigantes. */
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { html: text.slice(0, MAX_BYTES), finalUrl: res.url };
    }
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let total = 0;
    let html = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        html += decoder.decode(value.subarray(0, value.byteLength - (total - MAX_BYTES)));
        break;
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return { html, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Versão testável (sem fetch): recebe o HTML já obtido e devolve o mesmo
 * formato que `extractGoogleLanding`. Útil para tests/fixtures.
 */
export function extractFromHtml(html: string, finalUrl: string): LandingExtractResult {
  const parsedUrl = new URL(finalUrl);
  const parsed = parseHtml(html);

  /** Extracção JSON-LD Product/Offer. */
  let priceText: string | null = null;
  let priceFullText: string | null = null;
  let productName: string | null = null;
  let productDescription: string | null = null;
  for (const ld of parsed.jsonLd) {
    const product = findNode(ld, "Product");
    if (product) {
      if (typeof product.name === "string" && !productName) productName = product.name;
      if (typeof product.description === "string" && !productDescription) {
        productDescription = product.description;
      }
      const offers = product.offers;
      const offerNode = offers && typeof offers === "object" ? findNode(offers, "Offer") ?? (offers as Record<string, unknown>) : null;
      if (offerNode) {
        if (!priceText) {
          priceText = formatPrice(offerNode.price ?? offerNode.lowPrice, offerNode.priceCurrency);
        }
        if (!priceFullText && (offerNode.highPrice || offerNode.priceSpecification)) {
          priceFullText = formatPrice(offerNode.highPrice, offerNode.priceCurrency);
        }
      }
    }
  }

  const titleText = parsed.ogTitle || parsed.title || productName;
  const descText = parsed.ogDescription || parsed.description || productDescription;

  const offerSuggestion = (() => {
    const parts = [titleText, descText].filter((x): x is string => Boolean(x?.trim()));
    if (!parts.length) return null;
    return clip(parts.join(" — "), 500);
  })();

  const fullText = [titleText, descText, parsed.bodyText].filter(Boolean).join(" \n ").slice(0, 200_000);

  const guarantee = detectGuarantee(fullText);
  const shipping = detectShipping(fullText);
  const discount = detectDiscount(fullText);
  const certifications = detectCertifications(fullText);
  const attributes = detectAttributes(fullText);

  const signals: GoogleProductSignals = {};
  const sources: Record<keyof GoogleProductSignals, string | undefined> = {
    price: undefined,
    price_full: undefined,
    discount: undefined,
    guarantee: undefined,
    shipping: undefined,
    bundles: undefined,
    bonuses: undefined,
    certifications: undefined,
    attributes: undefined,
  };
  if (priceText) {
    signals.price = clip(priceText, 20);
    sources.price = "JSON-LD";
  }
  if (priceFullText && priceFullText !== priceText) {
    signals.price_full = clip(priceFullText, 20);
    sources.price_full = "JSON-LD";
  }
  if (discount) {
    signals.discount = clip(discount, 28);
    sources.discount = "Texto da página";
  }
  if (guarantee) {
    signals.guarantee = clip(guarantee, 40);
    sources.guarantee = "Texto da página";
  }
  if (shipping) {
    signals.shipping = clip(shipping, 28);
    sources.shipping = "Texto da página";
  }
  if (certifications) {
    signals.certifications = clip(certifications, 40);
    sources.certifications = "Texto da página";
  }
  if (attributes.length) {
    signals.attributes = attributes.slice(0, 5).map((a) => clip(a, 30));
    sources.attributes = "Texto da página";
  }

  return {
    ok: true,
    url: finalUrl,
    hostname: parsedUrl.hostname.replace(/^www\./i, ""),
    language: parsed.language ? parsed.language.slice(0, 2).toLowerCase() : null,
    offer_suggestion: offerSuggestion,
    signals,
    sources,
  };
}

export async function extractGoogleLanding(rawUrl: string): Promise<LandingExtractResult | LandingExtractError> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { ok: false, error: "URL inválida." };
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return { ok: false, error: "Apenas URLs http/https são suportadas." };
  }
  if (isPrivateHost(parsedUrl.hostname)) {
    return { ok: false, error: "Host privado não é permitido." };
  }

  let fetched: { html: string; finalUrl: string };
  try {
    fetched = await fetchHtml(parsedUrl.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao obter página.";
    return { ok: false, error: `Não consegui aceder à landing: ${msg}` };
  }

  return extractFromHtml(fetched.html, fetched.finalUrl);
}

import type { RichLocalePack } from "./presellLocalePack";
import {
  buildDiscountHeadline,
  localePack,
  officialBuyCta,
  referencePriceLineCompact,
  referencePriceLineRich,
  socialProofFallback,
} from "./presellLocalePack";
import { acceptLanguageForPresellImport, fetchHtmlAfterJsRender } from "./presellFoldBrowser";

type ImportPresellInput = {
  productUrl: string;
  language?: string;
  affiliateLink?: string;
};

export type ImportStorefrontTheme = "dark_commerce" | "default";

export type ImportPresellResult = {
  product_name: string;
  title: string;
  subtitle: string;
  sales_text: string;
  cta_text: string;
  images: string[];
  source_url: string;
  affiliate_link: string;
  video_url?: string;
  /**
   * Heurística a partir do HTML da dobra: landings escuras (suplemento / funil) usam layout
   * espelhado na presell pública para reduzir fricção com o anúncio.
   */
  storefront_theme: ImportStorefrontTheme;
  /** Campos para presell tipo desconto (extraídos da página quando possível). */
  discount_percent: number | null;
  discount_headline: string;
  social_proof: string;
  rating_value: string;
  rating_stars: number;
  urgency_timer_seconds: number;
  /** Texto do botão principal em presell “desconto”. */
  official_buy_cta: string;
};

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NOISE_P = /cookie|lgpd|privacidade|privacy policy|termos de uso|gdpr|consentimento/i;

/** Metadados do nosso app / builders genéricos — não usar como produto. */
const GARBAGE_META =
  /dclickora|clickora|lovable|presell pages.*tracking|your app will live|ask lovable|vite\.svg|localhost:\d+/i;

const ORDER_NOISE = /^order\s+\d|^claim your|^below while stocks|^get\s+\d|^every\s+\d|^bonus\s*#|^\*for international/i;

/** Texto de builders / modelos — não usar como título ou subtítulo. */
const PLACEHOLDER_HEADING =
  /add\s+heading|heading\s+text\s+here|your\s+(title|headline|text|subheading)\s+here|lorem\s+ipsum|placeholder|click\s+to\s+edit|subheading\s+here|type\s+your|coming\s+soon|untitled\s+section|double\s+click\s+to\s+edit/i;

function isPlaceholderHeading(text: string): boolean {
  const t = cleanText(text);
  if (!t) return true;
  return PLACEHOLDER_HEADING.test(t);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value: string | undefined | null) {
  if (!value) return "";
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function stripTags(html: string) {
  return cleanText(html.replace(/<[^>]+>/g, " ").replace(/\*{2,}/g, ""));
}

export function assertExternalProductUrl(url: string): void {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error("URL inválido.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Use um link que comece com https://");
  }
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) {
    throw new Error("Não use localhost — cole o link público da página do produto (ex.: theneotonics.com/...).");
  }
  if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) {
    throw new Error("URL inválido para importação.");
  }
}

function brandFromHostname(hostname: string): string {
  const base = hostname.replace(/^www\./, "").split(".")[0] || "";
  if (!base) return "Produto";
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

function splitBrandFromPageTitle(title: string): string {
  const t = cleanText(title);
  if (!t) return "";
  const parts = t.split(/\s*[-–|]\s*/);
  const first = parts[0]?.trim() || t;
  const genericSecond = /^(text presentation|official site|home|welcome)$/i;
  if (parts.length >= 2 && genericSecond.test(parts[1]?.trim() || "")) {
    return first;
  }
  return first;
}

function extractMeta(html: string, name: string) {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function extractTagText(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanText(match?.[1] || "");
}

/**
 * Mantém o comprimento do HTML para índices alinhados ao original (útil para marcar fim da dobra).
 */
function maskScriptsAndStylesPreservingLength(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, (m) => " ".repeat(m.length))
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => " ".repeat(m.length));
}

/**
 * Índice onde termina aproximadamente a "primeira dobra": antes do rodapé / secções típicas de fim de página.
 * Sem marcador confiável, limita aos primeiros ~55k após <body> (hero + galeria na maioria dos PDPs).
 */
function findFirstFoldCutIndex(html: string): number {
  const masked = maskScriptsAndStylesPreservingLength(html);
  const lower = masked.toLowerCase();
  const bodyMatch = html.match(/<body[^>]*>/i);
  const bodyStart = bodyMatch?.index != null ? bodyMatch.index + bodyMatch[0].length : 0;
  const minContent = bodyStart + 800;
  const softCap = Math.min(html.length, bodyStart + 55_000);

  const candidates: number[] = [];
  const add = (needle: string) => {
    const i = lower.indexOf(needle, minContent);
    if (i > 0) candidates.push(i);
  };

  add("<footer");
  add("shopify-section-footer");
  add("id=\"colophon\"");
  add("site-footer");
  add("<!-- wp:footer");

  if (candidates.length === 0) return softCap;
  return Math.min(...candidates, softCap);
}

function htmlFirstFold(html: string): string {
  const cut = findFirstFoldCutIndex(html);
  return html.slice(0, Math.min(cut, html.length));
}

function relativeLuminance255(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function rgbFromHex6(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(h)) return null;
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function expandHex3(hex3: string): string {
  const s = hex3.slice(1);
  if (s.length !== 3) return hex3;
  return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
}

/** Deteta cor CSS simples (hex, rgb, keyword black). Ignora `url()` e a maior parte de gradients. */
function chunkLooksLikeDarkBackground(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (t === "black" || t === "#000" || t === "#000000") return true;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(t)) {
    const full = t.length === 4 ? expandHex3(t) : t;
    const rgb = rgbFromHex6(full);
    if (rgb && relativeLuminance255(rgb.r, rgb.g, rgb.b) < 0.2) return true;
  }
  const rgbM = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgbM) {
    const r = +rgbM[1];
    const g = +rgbM[2];
    const b = +rgbM[3];
    if ([r, g, b].every((n) => !Number.isNaN(n)) && relativeLuminance255(r, g, b) < 0.2) return true;
  }
  if (/\b(#0f172a|#020617|#111111|#1a1a1a|navy)\b/.test(t)) return true;
  return false;
}

function gradientHasDarkStop(val: string): boolean {
  let hits = 0;
  for (const m of val.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
    const full = m[1].length === 3 ? expandHex3(`#${m[1]}`) : `#${m[1]}`;
    const rgb = rgbFromHex6(full.toLowerCase());
    if (rgb && relativeLuminance255(rgb.r, rgb.g, rgb.b) < 0.22) hits++;
  }
  const rgbStops = val.matchAll(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/gi);
  for (const m of rgbStops) {
    const r = +m[1];
    const g = +m[2];
    const b = +m[3];
    if ([r, g, b].every((n) => !Number.isNaN(n)) && relativeLuminance255(r, g, b) < 0.22) hits++;
  }
  return hits >= 1;
}

/**
 * Landings escuras (hero preto/azul, texto claro) → presell com header + hero escuros e corpo claro.
 */
export function detectImportStorefrontTheme(html: string, foldHtml: string): ImportStorefrontTheme {
  const sample = foldHtml.slice(0, 48_000);
  const lower = sample.toLowerCase();

  if (/\bbg-(black|zinc-950|zinc-900|gray-950|gray-900|slate-950|slate-900|neutral-950|neutral-900)\b/.test(lower)) {
    return "dark_commerce";
  }
  if (/\bfrom-(black|zinc-950|zinc-900|gray-950|gray-900|slate-950|slate-900)\b/.test(lower)) {
    return "dark_commerce";
  }
  if (/bg-\[#0[0-4][0-9a-f]{4}\]/i.test(sample)) return "dark_commerce";
  if (/bg-\[#1[0-2][0-9a-f]{4}\]/i.test(sample)) return "dark_commerce";

  const themeColor = extractMeta(html, "theme-color");
  if (themeColor) {
    const normalized = themeColor.split(/\s+/)[0]?.trim() || themeColor;
    if (chunkLooksLikeDarkBackground(normalized)) return "dark_commerce";
  }

  let darkBgHits = 0;
  for (const m of sample.matchAll(/background(?:-color)?\s*:\s*([^;}{<]+)/gi)) {
    let val = m[1].replace(/!important/gi, "").trim();
    if (/^url\(/i.test(val)) continue;
    if (/linear-gradient|radial-gradient/i.test(val)) {
      if (gradientHasDarkStop(val)) darkBgHits++;
      continue;
    }
    if (chunkLooksLikeDarkBackground(val)) darkBgHits++;
  }

  if (darkBgHits >= 2) return "dark_commerce";
  if (darkBgHits === 1 && /\b(color\s*:\s*(#fff|#f8|#f9|white)|text-white)\b/i.test(sample)) {
    return "dark_commerce";
  }

  if (/\btext-white\b/.test(lower) && /\b(bg-black|background\s*:\s*#\s*0|bg-slate-9|bg-zinc-9|bg-gray-9)\b/.test(lower)) {
    return "dark_commerce";
  }

  return "default";
}

/** Reduz ruído de SVG (paths enormes) ao detetar se o HTML estático tem texto útil na dobra. */
function maskSvgBlocksForScan(html: string): string {
  return html.replace(/<svg[\s\S]*?<\/svg>/gi, (m) => " ".repeat(m.length));
}

/**
 * Landings SPA: shell sem <h1> nem corpo na primeira dobra — o import precisa de browser.
 */
export function staticHtmlLikelyMissingMainContent(html: string): boolean {
  const fold = maskSvgBlocksForScan(htmlFirstFold(html));
  if (/<h1\b/i.test(fold)) {
    const h1Text = extractTagText(fold, "h1");
    if (h1Text.length >= 12 && !isPlaceholderHeading(h1Text)) return false;
  }
  const headings = extractHeadings(fold).filter((h) => !isPlaceholderHeading(h) && h.length >= 12);
  const paragraphs = extractParagraphs(fold);
  const listItems = extractListItemsFromHtml(fold);
  if (headings.length >= 1 && paragraphs.length >= 1) return false;
  if (listItems.length >= 3) return false;
  if (!/<h1\b/i.test(fold)) return true;
  return headings.length === 0 && paragraphs.length < 2 && listItems.length < 2;
}

function bestUrlFromSrcset(srcset: string): string {
  const candidates: { url: string; w: number }[] = [];
  for (const part of srcset.split(",")) {
    const bit = part.trim();
    if (!bit) continue;
    const m = bit.match(/^(\S+)(?:\s+(\d+)w)?(?:\s+([\d.]+)x)?$/i);
    if (!m?.[1]) continue;
    const w = m[2] ? parseInt(m[2], 10) : 0;
    candidates.push({ url: m[1], w });
  }
  if (candidates.length === 0) return "";
  candidates.sort((a, b) => b.w - a.w);
  return candidates[0].url;
}

function extractHeadings(html: string): string[] {
  const out: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 50) {
    const t = stripTags(m[1] || "");
    if (t.length >= 8 && t.length < 400) out.push(t);
  }
  return out;
}

function extractParagraphs(html: string): string[] {
  const results: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && results.length < 45) {
    const txt = stripTags(m[1] || "");
    if (
      txt.length >= 28 &&
      !NOISE_P.test(txt) &&
      !GARBAGE_META.test(txt) &&
      !isPlaceholderHeading(txt)
    ) {
      results.push(txt);
    }
  }
  return results;
}

/** Bullets reais da página (ex.: benefícios no PDP) — evita só texto genérico do template. */
function extractListItemsFromHtml(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 28) {
    const txt = stripTags(m[1] || "");
    const t = txt.replace(/\s+/g, " ").trim();
    if (t.length < 14 || t.length > 280) continue;
    if (NOISE_P.test(t) || GARBAGE_META.test(t) || isPlaceholderHeading(t)) continue;
    if (/^(menu|home|shop|cart|login|search|help|close)$/i.test(t)) continue;
    const key = t.slice(0, 56).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function extractSrcFromImgTag(tag: string): string {
  const srcsetM = tag.match(/\bsrcset=["']([^"']+)["']/i);
  if (srcsetM?.[1]) {
    const best = bestUrlFromSrcset(srcsetM[1]);
    if (best) return cleanText(best);
  }
  const dataLazy =
    tag.match(/\bdata-src=["']([^"']+)["']/i) ||
    tag.match(/\bdata-lazy-src=["']([^"']+)["']/i) ||
    tag.match(/\bdata-original=["']([^"']+)["']/i);
  if (dataLazy?.[1]) return cleanText(dataLazy[1]);
  const src = tag.match(/\bsrc=["']([^"']+)["']/i);
  return cleanText(src?.[1] || "");
}

function isLikelyTrackingOrIcon(url: string) {
  const u = url.toLowerCase();
  return u.includes("facebook.com/tr") || u.includes("googleads") || u.includes("doubleclick") || u.includes("spacer.gif");
}

/** Ícones de pagamento, bandeiras, favicons — raramente são foto do produto. */
function isLikelyNonProductImageUrl(url: string): boolean {
  const u = decodeURI(url).toLowerCase();
  if (/favicon|\.ico(\?|$)|\/icon\.png|spacer|pixel\.|1x1|clear\.gif|blank\.gif|chrome-extension:/i.test(u)) {
    return true;
  }
  if (
    /\/flags?[-/]|country[_-]flag|payment[_-]?(method|icon)|\bvisa[_-]|mastercard|maestro|amex|discover|paypal[_-]logo|apple[_-]?pay|google[_-]?pay|klarna|gpay/i.test(
      u,
    )
  ) {
    return true;
  }
  if (/google-analytics|facebook\.com\/tr|doubleclick|googletagmanager|gstatic\.com\/recaptcha/i.test(u)) {
    return true;
  }
  return false;
}

function walkJsonLdForProductImages(obj: unknown, out: string[], depth: number): void {
  if (depth > 12 || out.length > 40) return;
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (const x of obj) walkJsonLdForProductImages(x, out, depth + 1);
    return;
  }
  if (typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;

  const pushImageVal = (v: unknown) => {
    if (typeof v === "string" && v.trim()) {
      out.push(v.trim());
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) pushImageVal(x);
      return;
    }
    if (v && typeof v === "object") {
      const img = v as Record<string, unknown>;
      if (typeof img.url === "string") out.push(img.url.trim());
      if (Array.isArray(img.url)) for (const x of img.url) if (typeof x === "string") out.push(x.trim());
    }
  };

  pushImageVal(o.image);
  pushImageVal(o.thumbnailUrl);

  for (const [k, v] of Object.entries(o)) {
    if (k === "image" || k === "thumbnailUrl") continue;
    if (typeof v === "object" || Array.isArray(v)) walkJsonLdForProductImages(v, out, depth + 1);
  }
}

function extractImageUrlsFromJsonLd(html: string): string[] {
  const raw: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const j = JSON.parse(m[1]?.trim() || "null") as unknown;
      walkJsonLdForProductImages(j, raw, 0);
    } catch {
      /* ignore */
    }
  }
  return raw;
}

function extractPreloadImageHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 16) {
    const tag = m[0];
    if (!/\bas\s*=\s*["']image["']/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) out.push(decodeHtml(href));
  }
  return out;
}

function extractVideoPosterUrls(html: string): string[] {
  const out: string[] = [];
  const re = /<video\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 8) {
    const tag = m[0];
    const poster = tag.match(/\bposter=["']([^"']+)["']/i)?.[1];
    if (poster) out.push(decodeHtml(poster));
  }
  return out;
}

/**
 * Imagens do produto: meta, JSON-LD, preload, posters, depois &lt;img&gt;/srcset na dobra e no HTML completo.
 * Garante pelo menos uma URL quando existir qualquer imagem recuperável no documento.
 */
function extractProductImages(fullHtml: string, baseUrl: string, foldHtml: string): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const htmlScan = fullHtml.length > 450_000 ? fullHtml.slice(0, 450_000) : fullHtml;

  const tryPush = (raw: string, allowNoisy: boolean) => {
    const s = cleanText(decodeHtml(raw));
    if (!s || s.startsWith("data:")) return;
    const abs = toAbsoluteUrl(s, baseUrl);
    if (!abs || seen.has(abs)) return;
    if (isLikelyTrackingOrIcon(abs)) return;
    if (!allowNoisy && isLikelyNonProductImageUrl(abs)) return;
    seen.add(abs);
    ordered.push(abs);
  };

  for (const metaKey of ["og:image:secure_url", "og:image", "twitter:image:src", "twitter:image"]) {
    const v = extractMeta(fullHtml, metaKey);
    if (v) tryPush(v, false);
  }

  for (const u of extractImageUrlsFromJsonLd(fullHtml)) tryPush(u, false);
  for (const u of extractPreloadImageHrefs(fullHtml)) tryPush(u, false);
  for (const u of extractVideoPosterUrls(htmlScan)) tryPush(u, false);

  const scanImgAndSource = (chunk: string, allowNoisy: boolean) => {
    const imgTagRe = /<img[^>]*>/gi;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = imgTagRe.exec(chunk)) !== null && ordered.length < 28) {
      const src = extractSrcFromImgTag(tagMatch[0]);
      if (src) tryPush(src, allowNoisy);
    }
    const sourceTagRe = /<source\b[^>]*>/gi;
    while ((tagMatch = sourceTagRe.exec(chunk)) !== null && ordered.length < 28) {
      const tag = tagMatch[0];
      const srcsetRaw =
        tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1] || tag.match(/\bsrcset=([^\s>]+)/i)?.[1];
      if (!srcsetRaw) continue;
      const pick = bestUrlFromSrcset(decodeHtml(srcsetRaw));
      if (pick) tryPush(pick, allowNoisy);
    }
  };

  scanImgAndSource(foldHtml, false);
  scanImgAndSource(htmlScan, false);

  if (ordered.length < 2) {
    for (const u of extractImageUrlsFromJsonLd(fullHtml)) tryPush(u, true);
    scanImgAndSource(htmlScan, true);
  }

  if (ordered.length === 0) {
    const imgTagRe = /<img[^>]*>/gi;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = imgTagRe.exec(htmlScan)) !== null && ordered.length < 4) {
      const src = extractSrcFromImgTag(tagMatch[0]);
      if (!src || src.startsWith("data:")) continue;
      const abs = toAbsoluteUrl(cleanText(src), baseUrl);
      if (!abs || seen.has(abs) || isLikelyTrackingOrIcon(abs)) continue;
      seen.add(abs);
      ordered.push(abs);
    }
  }

  return ordered.filter(Boolean).slice(0, 18);
}

function toAbsoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function detectPrice(html: string) {
  const priceMeta = extractMeta(html, "product:price:amount");
  if (priceMeta) return priceMeta;
  const match = html.match(/(R\$\s?\d[\d.,]*)|(\$\s?\d[\d.,]*)|(€\s?\d[\d.,]*)/i);
  return cleanText(match?.[0] || "");
}

/** Texto plano limitado para regex de desconto / prova social. */
function htmlToSearchableText(html: string) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  return stripTags(noScript);
}

function extractDiscountPercentFromText(text: string): number | null {
  const patterns: RegExp[] = [
    /up\s+to\s+(\d{1,2})\s*%/i,
    /(?:save|economize|ahorra)\s+(\d{1,2})\s*%/i,
    /(\d{1,2})\s*%\s*(?:off|discount|descuento|desconto|dto\.?)/i,
    /(\d{1,2})\s*%\s*OFF\b/i,
    /(\d{1,2})\s*%\s*de\s+desconto/i,
    /desconto\s+de\s+(\d{1,2})\s*%/i,
    /(?:discount|desconto)\s*:?\s*(\d{1,2})\s*%/i,
    /(\d{1,2})\s*%\s*reduction/i,
  ];
  let best: number | null = null;
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n >= 5 && n <= 95) best = best == null ? n : Math.max(best, n);
    }
  }
  return best;
}

function extractSocialProofLine(text: string): string | null {
  const patterns: RegExp[] = [
    /\d{1,2}\s+out\s+of\s+10[^.\n]{0,160}/i,
    /\d\s+de\s+10[^.\n]{0,160}/i,
    /(?:most|maioria|mayoría)[^.\n]{0,120}(?:prefer|prefieren|prefere)[^.\n]{0,80}/i,
    /\d+\s*%\s+of\s+customers[^.\n]{0,120}/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) {
      const line = cleanText(m[0]);
      if (line.length >= 12 && line.length < 220) return line;
    }
  }
  return null;
}

function extractRatingFromHtml(html: string): string | null {
  const ld = html.match(/"aggregateRating"\s*:\s*\{[^}]*"ratingValue"\s*:\s*"?([\d.,]+)/i);
  if (ld?.[1]) return ld[1].replace(",", ".");
  const text = htmlToSearchableText(html);
  const m10 = text.match(/\b(\d(?:\.\d)?)\s*\/\s*10\b/);
  if (m10?.[1]) {
    const v = parseFloat(m10[1]);
    if (v >= 1 && v <= 10) return m10[1];
  }
  const m2 = html.match(/\b(\d(?:\.\d)?)\s*\/\s*5\b/);
  if (m2?.[1]) return m2[1];
  const m3 = text.match(/\b(?:rating|score|stars?)[:\s]+(\d(?:\.\d)?)\b/i);
  if (m3?.[1]) {
    const v = parseFloat(m3[1]);
    if (v >= 1 && v <= 10) return m3[1];
  }
  return null;
}

function extractDiscountSignals(html: string, language: string) {
  const text = htmlToSearchableText(html);
  const percent = extractDiscountPercentFromText(text);
  const headline = buildDiscountHeadline(percent, language);
  const social = extractSocialProofLine(text) || socialProofFallback(language);
  const rating = extractRatingFromHtml(html) || "4.9";
  return {
    discount_percent: percent,
    discount_headline: headline,
    social_proof: social,
    rating_value: rating,
    rating_stars: 5,
    urgency_timer_seconds: 649,
  };
}

function normalizeYoutubeToEmbed(url: string): string {
  const u = url.trim();
  const embed = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/i);
  if (embed) return `https://www.youtube.com/embed/${embed[1]}`;
  const watch = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  const short = u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  return u;
}

function normalizeVideoCandidate(raw: string, pageUrl: string): string | undefined {
  let s = decodeHtml(raw).trim();
  if (!s || s.startsWith("javascript:") || s.startsWith("data:")) return undefined;
  if (s.startsWith("//")) s = `https:${s}`;
  const abs = /^https?:\/\//i.test(s) ? s : toAbsoluteUrl(s, pageUrl);
  if (!abs) return undefined;
  return abs;
}

/** Iframes de tracking, mapas, chat — não são VSL. */
function isJunkVideoContainerUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (
    u.includes("facebook.com/plugins") ||
    u.includes("facebook.net") ||
    u.includes("googletagmanager.com") ||
    u.includes("google.com/maps") ||
    u.includes("maps.google") ||
    u.includes("doubleclick.net") ||
    u.includes("googlesyndication") ||
    u.includes("recaptcha") ||
    u.includes("gstatic.com/recaptcha") ||
    u.includes("sharethis") ||
    u.includes("addthis") ||
    u.includes("hotjar.com") ||
    u.includes("clarity.ms") ||
    u.includes("pixel") && u.includes("facebook")
  ) {
    return true;
  }
  return false;
}

function scoreVideoUrl(url: string): number {
  const u = url.toLowerCase();
  let score = 0;
  if (/youtube\.com\/embed|youtu\.be|youtube-nocookie/i.test(u)) score += 12;
  else if (/youtube\.com\/watch|[?&]v=[a-z0-9_-]{11}/i.test(u)) score += 10;
  if (/player\.vimeo\.com|vimeo\.com\/video|vimeo\.com\/embed/i.test(u)) score += 12;
  else if (/vimeo\.com\/\d+/i.test(u)) score += 8;
  if (/wistia\.com|wi\.st|fast\.wistia\.net/i.test(u)) score += 11;
  if (/loom\.com\/embed/i.test(u)) score += 11;
  if (/dailymotion\.com\/embed|dai\.ly\//i.test(u)) score += 9;
  if (/\.mp4(\?|#|$)/i.test(u) || /\.webm(\?|#|$)/i.test(u)) score += 7;
  if (/\.m3u8(\?|#|$)/i.test(u)) score += 6;
  if (/cloudflarestream\.com|videodelivery\.net|mux\.com/i.test(u)) score += 8;
  if (/jwplayer|jwplatform|brightcove|video\.js/i.test(u)) score += 6;
  if (/vturb|smartplayer|plyr|videojs/i.test(u)) score += 5;
  if (/\/embed\//i.test(u) && !isJunkVideoContainerUrl(u)) score += 3;
  return score;
}

function pickBestVideoUrl(candidates: string[], pageUrl: string): string | undefined {
  let best: { url: string; score: number } | undefined;
  for (const raw of candidates) {
    const n = normalizeVideoCandidate(raw, pageUrl);
    if (!n || isJunkVideoContainerUrl(n)) continue;
    const sc = scoreVideoUrl(n);
    if (sc < 3) continue;
    if (!best || sc > best.score) best = { url: n, score: sc };
  }
  return best?.url;
}

function extractAttrFromTag(tag: string, attr: string): string | undefined {
  const re = new RegExp(`\\b${attr}=["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m?.[1] !== undefined ? decodeHtml(m[1]) : undefined;
}

function collectIframeVideoCandidates(html: string): string[] {
  const out: string[] = [];
  const re = /<iframe\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const src =
      extractAttrFromTag(tag, "src") ||
      extractAttrFromTag(tag, "data-src") ||
      extractAttrFromTag(tag, "data-lazy-src") ||
      extractAttrFromTag(tag, "data-original") ||
      extractAttrFromTag(tag, "data-video-url") ||
      extractAttrFromTag(tag, "data-url");
    if (src?.trim()) out.push(src.trim());
  }
  return out;
}

/** <video src=…> e atributos lazy comuns em landings. */
function collectVideoTagCandidates(html: string): string[] {
  const out: string[] = [];
  const re = /<video\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    for (const attr of ["src", "data-src", "data-video", "data-video-url", "data-mp4", "data-lazy-src"]) {
      const v = extractAttrFromTag(tag, attr);
      if (v?.trim()) out.push(v.trim().split(/\s+/)[0]);
    }
  }
  return out;
}

/**
 * Muitas páginas de venda (ex.: VSL) só colocam o URL do vídeo dentro de <script> ou em strings JSON.
 * Procura padrões explícitos (não “qualquer URL” para evitar ruído).
 */
function extractVideoUrlsFromScriptsAndInline(html: string): string[] {
  const out: string[] = [];
  const scriptBodies: string[] = [];
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = scriptRe.exec(html)) !== null) {
    if (sm[1]) scriptBodies.push(sm[1]);
  }
  const blob = `${scriptBodies.join("\n")}\n${html}`;
  const patterns: RegExp[] = [
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?[^\s"'<>]{5,400}/gi,
    /https?:\/\/(?:www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{6,20}/gi,
    /https?:\/\/(?:www\.)?youtube-nocookie\.com\/embed\/[a-zA-Z0-9_-]{6,20}/gi,
    /https?:\/\/(?:www\.)?youtu\.be\/[a-zA-Z0-9_-]{6,20}/gi,
    /https?:\/\/player\.vimeo\.com\/video\/\d{5,12}/gi,
    /https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?\d{5,12}/gi,
    /https?:\/\/(?:fast\.)?wistia\.(?:net|com)\/[^"'\s<>]{10,500}/gi,
    /https?:\/\/[^"'\s<>]+\.(?:mp4|webm|m3u8)(?:\?[^"'\s<>]{0,120})?/gi,
    /https?:\/\/[^"'\s<>]*(?:stream|video|player|embed|cdn)[^"'\s<>]*\.(?:mp4|m3u8)(?:\?[^"'\s<>]{0,80})?/gi,
  ];
  for (const re of patterns) {
    let mm: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((mm = re.exec(blob)) !== null) {
      let u = mm[0].replace(/[),.;}\]]+$/g, "").trim();
      if (u.length > 8 && u.length < 2500) out.push(u);
    }
  }
  return out;
}

function walkJsonLdForVideo(obj: unknown, out: string[]): void {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (const x of obj) walkJsonLdForVideo(x, out);
    return;
  }
  if (typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  const types = o["@type"];
  const typeStr = Array.isArray(types) ? types.join(" ") : String(types ?? "");
  if (/VideoObject/i.test(typeStr)) {
    for (const k of ["embedUrl", "contentUrl", "url"]) {
      const v = o[k];
      if (typeof v === "string" && v.startsWith("http")) out.push(v);
    }
  }
  for (const v of Object.values(o)) walkJsonLdForVideo(v, out);
}

function extractVideoUrlsFromJsonLd(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const raw = m[1]?.trim();
      if (!raw) continue;
      const j = JSON.parse(raw) as unknown;
      walkJsonLdForVideo(j, out);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function finalizeVideoPlayableUrl(url: string): string {
  const u = url.trim();
  if (/youtube|youtu\.be/i.test(u) && !/\.(mp4|webm)/i.test(u)) return normalizeYoutubeToEmbed(u);
  return u;
}

/**
 * Extrai o melhor URL de vídeo da página do produtor (vários iframes, meta, JSON-LD, <video>).
 * Não executa JavaScript — páginas que só injetam o vídeo via JS podem não expor URL no HTML.
 */
function extractVideoUrl(html: string, pageUrl: string): string | undefined {
  const candidates: string[] = [];

  const ogVideo = extractMeta(html, "og:video:url") || extractMeta(html, "og:video");
  if (ogVideo) candidates.push(ogVideo);

  const twPlayer = extractMeta(html, "twitter:player");
  if (twPlayer) candidates.push(twPlayer);

  candidates.push(...extractVideoUrlsFromJsonLd(html));

  const linkVideo = html.match(/<link[^>]+rel=["']video_src["'][^>]+href=["']([^"']+)["']/i);
  if (linkVideo?.[1]) candidates.push(linkVideo[1]);

  candidates.push(...collectIframeVideoCandidates(html));
  candidates.push(...collectVideoTagCandidates(html));

  const videoTag = html.match(/<video[^>]+src=["']([^"']+)["']/i);
  if (videoTag?.[1]) candidates.push(videoTag[1]);

  const sourceTag = html.match(/<source[^>]+src=["']([^"']+)["']/i);
  if (sourceTag?.[1]) candidates.push(sourceTag[1]);

  candidates.push(...extractVideoUrlsFromScriptsAndInline(html));

  const watchInPage = html.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?[^"'\s<>]+/i);
  if (watchInPage?.[0]) candidates.push(watchInPage[0]);

  const shortInPage = html.match(/https?:\/\/(?:www\.)?youtu\.be\/[a-zA-Z0-9_-]+/i);
  if (shortInPage?.[0]) candidates.push(shortInPage[0]);

  const vimeoInText = html.match(/https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?\d+/i);
  if (vimeoInText?.[0]) {
    const id = vimeoInText[0].match(/(\d+)\s*$/);
    if (id?.[1]) candidates.push(`https://player.vimeo.com/video/${id[1]}`);
  }

  const best = pickBestVideoUrl(candidates, pageUrl);
  if (best) return finalizeVideoPlayableUrl(best);

  return undefined;
}

function firstSentences(text: string, maxChars: number): string {
  const t = cleanText(text);
  if (!t) return "";
  if (t.length <= maxChars) return t;
  const parts = t.split(/(?<=[.!?])\s+/);
  let out = "";
  for (const p of parts) {
    if ((out + " " + p).trim().length > maxChars) break;
    out = out ? `${out} ${p}` : p;
  }
  return out || `${t.slice(0, maxChars).trim()}…`;
}

function isGarbageDescription(text: string): boolean {
  return !text || GARBAGE_META.test(text);
}

function pickHeroTitle(headings: string[], brand: string, metaTitle: string): string {
  const meta = cleanText(metaTitle);
  const good = headings.find(
    (h) =>
      h.length >= 12 &&
      h.length < 280 &&
      !ORDER_NOISE.test(h) &&
      !GARBAGE_META.test(h) &&
      !isPlaceholderHeading(h),
  );
  if (good && good.length >= 28) return good;
  if (
    meta.length >= 20 &&
    meta.length < 320 &&
    !isPlaceholderHeading(meta) &&
    !GARBAGE_META.test(meta)
  ) {
    return meta;
  }
  if (good) return good;
  return brand;
}

function subtitleFromMetaTail(metaTitle: string, hero: string): string | null {
  const meta = cleanText(metaTitle);
  if (!meta || isPlaceholderHeading(meta)) return null;
  const parts = meta.split(/\s*[-–|]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const tail = parts.slice(1).join(" — ");
  if (
    tail.length >= 18 &&
    tail.length < 280 &&
    !isPlaceholderHeading(tail) &&
    tail.toLowerCase() !== hero.toLowerCase() &&
    !hero.toLowerCase().includes(tail.toLowerCase())
  ) {
    return firstSentences(tail, 220);
  }
  return null;
}

function pickSubtitle(
  headings: string[],
  hero: string,
  description: string,
  locale: RichLocalePack,
  metaTitle: string,
): string {
  const next = headings.find(
    (h) =>
      h !== hero &&
      h.length > 18 &&
      h.length < 260 &&
      !ORDER_NOISE.test(h) &&
      !GARBAGE_META.test(h) &&
      !isPlaceholderHeading(h),
  );
  if (next) return next;
  const fromMeta = subtitleFromMetaTail(metaTitle, hero);
  if (fromMeta) return fromMeta;
  if (!isGarbageDescription(description) && description.length > 20) {
    return firstSentences(description, 220);
  }
  return locale.subtitleFallback;
}

/** Página longa (ex.: Neotonics): texto denso parecido com a oferta. */
function buildRichSalesText(
  paragraphs: string[],
  locale: RichLocalePack,
  price: string,
  language: string,
): string {
  const chunks = paragraphs.slice(0, 22);
  let body = chunks.join("\n\n");
  const max = 5200;
  if (body.length > max) body = `${body.slice(0, max).trim()}…`;

  const priceLine = referencePriceLineRich(language, price);

  return `${body}${priceLine}\n\n—\n${locale.richFooter}\n${locale.urgency}`.trim();
}

function buildCompactSalesText(args: {
  language: string;
  productName: string;
  description: string;
  price: string;
  paragraphs: string[];
  listItems: string[];
}): string {
  const locale = localePack(args.language);
  const primary = cleanText(args.description) || args.productName;
  const intro = firstSentences(primary, 420);
  const priceLine = args.price ? referencePriceLineCompact(args.language, args.price) : "";

  const pageBullets = args.listItems.filter((x) => {
    const s = cleanText(x);
    if (!s || isPlaceholderHeading(s)) return false;
    if (primary.length > 40 && primary.includes(s.slice(0, Math.min(40, s.length)))) return false;
    return true;
  });

  if (pageBullets.length >= 3) {
    const lines = pageBullets.slice(0, 10).map((b) => `• ${firstSentences(b, 200)}`);
    return `${intro}\n\n${lines.join("\n")}\n\n${priceLine}\n${locale.urgency}`.trim();
  }

  const extraBullets: string[] = [];
  for (const p of args.paragraphs) {
    if (p === primary || primary.includes(p.slice(0, 50))) continue;
    const snippet = firstSentences(p, 160);
    if (snippet && extraBullets.length < 3) extraBullets.push(snippet);
  }

  const template = `${intro}

${locale.sectionWhy}
• ${locale.bullet3}

${locale.sectionWhat}
• ${locale.bullet1}
• ${locale.bullet2}

${extraBullets.length ? `${locale.sectionFromPage}\n${extraBullets.map((b) => `• ${b}`).join("\n")}\n\n` : ""}${priceLine}
${locale.urgency}`.trim();

  return template;
}

function htmlLooksLikeWrongProduct(html: string, pageUrl: string): boolean {
  let host: string;
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
  if (host.includes("clickora") || host.includes("dclickora")) return false;

  const titleLower = extractTagText(html, "title").toLowerCase();
  const ogTitle = extractMeta(html, "og:title").toLowerCase();

  if (titleLower.includes("clickora") || ogTitle.includes("clickora")) return true;
  if (titleLower.includes("dclickora") || ogTitle.includes("dclickora")) return true;
  if (GARBAGE_META.test(extractMeta(html, "og:description"))) return true;
  return false;
}

const IMPORT_FETCH_MS = 14_000;

export async function importPresellFromProductUrl(input: ImportPresellInput): Promise<ImportPresellResult> {
  assertExternalProductUrl(input.productUrl);

  const language = input.language || "pt-BR";
  const acceptLang = acceptLanguageForPresellImport(language);

  let response: Response;
  try {
    response = await fetch(input.productUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(IMPORT_FETCH_MS),
      headers: {
        "user-agent": DEFAULT_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": acceptLang,
      },
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "AbortError" || /aborted|timeout/i.test(msg)) {
      throw new Error(
        `Timeout ao ler a página do produto (${Math.round(IMPORT_FETCH_MS / 1000)}s). Tente outro link ou confirme que o site responde rápido — pedidos lentos falham atrás do proxy.`,
      );
    }
    throw e;
  }

  if (!response.ok) {
    throw new Error(`Não foi possível ler a página do produto (${response.status}).`);
  }

  const finalUrl = response.url || input.productUrl;
  assertExternalProductUrl(finalUrl);

  let html = await response.text();
  const MIN_HTML_CHARS = 800;

  if (htmlLooksLikeWrongProduct(html, finalUrl)) {
    throw new Error(
      "O conteúdo obtido parece ser do painel dclickora, não do produto. Cole o link público da oferta (ex.: theneotonics.com/...), não localhost.",
    );
  }

  /** Respostas curtas são comuns com bloqueio a bots ou shell mínimo; um browser real pode obter o HTML completo. */
  const needsBrowserRender =
    html.length < MIN_HTML_CHARS || staticHtmlLikelyMissingMainContent(html);
  let renderedHtml: string | null = null;
  if (needsBrowserRender) {
    renderedHtml = await fetchHtmlAfterJsRender(finalUrl, acceptLang);
  }

  if (html.length < MIN_HTML_CHARS) {
    if (
      renderedHtml &&
      renderedHtml.length >= MIN_HTML_CHARS &&
      !htmlLooksLikeWrongProduct(renderedHtml, finalUrl)
    ) {
      html = renderedHtml;
    } else {
      throw new Error(
        [
          "O servidor recebeu pouco HTML (menos de ~800 caracteres).",
          "Causas frequentes: URL de redirecionamento ou incompleto; bloqueio a datacenters (ex.: Cloudflare); ou página que só preenche conteúdo com JavaScript.",
          "Confirma um link https:// completo da página de vendas pública. Se persistir, o site pode bloquear o import — usa o Editor manual ou outro URL da mesma oferta.",
        ].join(" "),
      );
    }
  } else if (
    renderedHtml &&
    renderedHtml.length >= 1200 &&
    !htmlLooksLikeWrongProduct(renderedHtml, finalUrl) &&
    !staticHtmlLikelyMissingMainContent(renderedHtml)
  ) {
    html = renderedHtml;
  }

  const locale = localePack(language);

  const pageHost = new URL(finalUrl).hostname;
  const brandFromHost = brandFromHostname(pageHost.replace(/^www\./, ""));

  const titleTag = extractTagText(html, "title");
  const ogTitle = extractMeta(html, "og:title");
  const h1 = extractTagText(html, "h1");

  let productName = splitBrandFromPageTitle(ogTitle || titleTag || "");
  if (!productName || GARBAGE_META.test(productName)) {
    productName = splitBrandFromPageTitle(h1) || brandFromHost;
  }
  if (GARBAGE_META.test(productName)) {
    productName = brandFromHost;
  }

  /** Conteúdo visível da primeira dobra — texto, listas, imagens inline e vídeo no hero. Metadados vêm do HTML completo. */
  const foldHtml = htmlFirstFold(html);

  const headings = extractHeadings(foldHtml).filter((h) => !isPlaceholderHeading(h));
  const paragraphs = extractParagraphs(foldHtml);
  const listItems = extractListItemsFromHtml(foldHtml);

  const ogDescription = extractMeta(html, "og:description");
  const metaDescription = extractMeta(html, "description");
  let description = cleanText(ogDescription || metaDescription || "");
  if (isGarbageDescription(description)) {
    description = paragraphs[0] || "";
  }
  if (isGarbageDescription(description)) {
    description = firstSentences(paragraphs.slice(0, 3).join(" "), 500);
  }

  const price = detectPrice(html);
  const images = extractProductImages(html, finalUrl, foldHtml);
  const video_url = extractVideoUrl(foldHtml, finalUrl);

  const metaTitleForHero = ogTitle || titleTag;
  const heroTitle = pickHeroTitle(headings, productName, metaTitleForHero);
  const subtitle = pickSubtitle(headings, heroTitle, description, locale, metaTitleForHero);

  const joinedLen = paragraphs.join("").length;
  const sales_text =
    joinedLen >= 900
      ? buildRichSalesText(paragraphs, locale, price, language)
      : buildCompactSalesText({
          language,
          productName,
          description: description || productName,
          price,
          paragraphs,
          listItems,
        });

  const discount = extractDiscountSignals(html, language);

  return {
    product_name: productName,
    title: heroTitle,
    subtitle,
    sales_text,
    cta_text: locale.cta,
    images,
    source_url: finalUrl,
    affiliate_link: input.affiliateLink || finalUrl,
    storefront_theme: detectImportStorefrontTheme(html, foldHtml),
    official_buy_cta: officialBuyCta(language),
    ...discount,
    ...(video_url ? { video_url } : {}),
  };
}

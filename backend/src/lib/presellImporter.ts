type ImportPresellInput = {
  productUrl: string;
  language?: string;
  affiliateLink?: string;
};

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
    if (txt.length >= 28 && !NOISE_P.test(txt) && !GARBAGE_META.test(txt)) {
      results.push(txt);
    }
  }
  return results;
}

function extractSrcFromImgTag(tag: string): string {
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

function extractImages(html: string, baseUrl: string) {
  const imageSet = new Set<string>();
  const ogImage = extractMeta(html, "og:image");
  if (ogImage) imageSet.add(toAbsoluteUrl(ogImage, baseUrl));

  const imgTagRe = /<img[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = imgTagRe.exec(html)) !== null && imageSet.size < 24) {
    const tag = tagMatch[0];
    const src = extractSrcFromImgTag(tag);
    if (!src || src.startsWith("data:") || isLikelyTrackingOrIcon(src)) continue;
    const absolute = toAbsoluteUrl(src, baseUrl);
    if (absolute) imageSet.add(absolute);
  }

  return Array.from(imageSet).filter(Boolean).slice(0, 18);
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

function buildDiscountHeadline(percent: number | null, language: string): string {
  const raw = (language || "pt").toLowerCase();
  const isEn = raw === "us" || raw.startsWith("en");
  const isEs = raw.startsWith("es");
  if (percent != null && percent >= 5) {
    if (isEn) return `Up to ${percent}% OFF`;
    if (isEs) return `Hasta ${percent}% OFF`;
    return `Até ${percent}% OFF`;
  }
  if (isEn) return "Limited time offer";
  if (isEs) return "Oferta por tiempo limitado";
  return "Oferta por tempo limitado";
}

function socialProofFallback(language: string): string {
  const raw = (language || "pt").toLowerCase();
  if (raw === "us" || raw.startsWith("en")) {
    return "8 out of 10 people prefer our product";
  }
  if (raw.startsWith("es")) {
    return "8 de cada 10 personas prefieren nuestro producto";
  }
  return "8 em cada 10 pessoas preferem o nosso produto";
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

function officialBuyCta(language: string): string {
  const raw = (language || "pt").toLowerCase();
  if (raw === "us" || raw.startsWith("en")) return "Buy on the Official Website";
  if (raw.startsWith("es")) return "Comprar en el sitio oficial";
  return "Comprar no site oficial";
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

function localePack(language: string) {
  const lang = (language || "pt").toLowerCase();
  if (lang === "en") {
    return {
      subtitleFallback: "Key information from the official offer page",
      cta: "Order Now",
      sectionWhy: "Why it matters",
      sectionWhat: "What you will find on the official page",
      sectionFromPage: "More from the offer",
      bullet1: "Transparent offer and conditions on the official site.",
      bullet2: "You can review everything before completing your purchase.",
      bullet3: "Focus on practical results you can evaluate with calm.",
      urgency: "Availability and conditions may change — check the official page.",
      richFooter: "Continue on the official page for full details, pricing, and secure checkout.",
    };
  }
  if (lang === "es") {
    return {
      subtitleFallback: "Información clave de la página oficial de la oferta",
      cta: "Quiero acceder ahora",
      sectionWhy: "Por qué importa",
      sectionWhat: "Qué encontrarás en la página oficial",
      sectionFromPage: "Más de la oferta",
      bullet1: "Oferta y condiciones transparentes en el sitio oficial.",
      bullet2: "Puedes revisar todo antes de finalizar la compra.",
      bullet3: "Enfoque en resultados prácticos que puedes evaluar con calma.",
      urgency: "La disponibilidad y las condiciones pueden cambiar — revisa la página oficial.",
      richFooter: "Continúa en la página oficial para precios completos y pago seguro.",
    };
  }
  return {
    subtitleFallback: "Informações da página oficial da oferta",
    cta: "Quero aproveitar agora",
    sectionWhy: "Por que isso importa",
    sectionWhat: "O que você encontra na página oficial",
    sectionFromPage: "Mais da oferta",
    bullet1: "Oferta e condições explicadas com transparência no site oficial.",
    bullet2: "Você pode revisar todas as informações antes de concluir a compra.",
    bullet3: "Foco em resultados práticos que você pode avaliar com calma.",
    urgency: "Disponibilidade e condições podem mudar — confira na página oficial.",
    richFooter: "Continue na página oficial para preços completos e checkout seguro.",
  };
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

function pickHeroTitle(headings: string[], brand: string): string {
  const good = headings.find(
    (h) =>
      h.length >= 28 &&
      h.length < 280 &&
      !ORDER_NOISE.test(h) &&
      !GARBAGE_META.test(h),
  );
  return good || brand;
}

function pickSubtitle(headings: string[], hero: string, description: string, locale: ReturnType<typeof localePack>): string {
  const next = headings.find((h) => h !== hero && h.length > 24 && h.length < 260 && !ORDER_NOISE.test(h));
  if (next) return next;
  if (!isGarbageDescription(description) && description.length > 20) {
    return firstSentences(description, 220);
  }
  return locale.subtitleFallback;
}

/** Página longa (ex.: Neotonics): texto denso parecido com a oferta. */
function buildRichSalesText(
  paragraphs: string[],
  locale: ReturnType<typeof localePack>,
  price: string,
  lang: string,
): string {
  const chunks = paragraphs.slice(0, 22);
  let body = chunks.join("\n\n");
  const max = 5200;
  if (body.length > max) body = `${body.slice(0, max).trim()}…`;

  const priceLine =
    price && lang === "en"
      ? `\n\nReference price on the official page: ${price}.`
      : price && lang === "es"
        ? `\n\nReferencia de precio en la página oficial: ${price}.`
        : price
          ? `\n\nReferência de valor na página oficial: ${price}.`
          : "";

  return `${body}${priceLine}\n\n—\n${locale.richFooter}\n${locale.urgency}`.trim();
}

function buildCompactSalesText(args: {
  language: string;
  productName: string;
  description: string;
  price: string;
  paragraphs: string[];
}): string {
  const locale = localePack(args.language);
  const lang = (args.language || "pt").toLowerCase();
  const primary = cleanText(args.description) || args.productName;
  const intro = firstSentences(primary, 420);

  const extraBullets: string[] = [];
  for (const p of args.paragraphs) {
    if (p === primary || primary.includes(p.slice(0, 50))) continue;
    const snippet = firstSentences(p, 160);
    if (snippet && extraBullets.length < 3) extraBullets.push(snippet);
  }

  const priceLine =
    args.price && lang === "en"
      ? `Offer reference on the official page: ${args.price}.`
      : args.price && lang === "es"
        ? `Referencia de precio en la página oficial: ${args.price}.`
        : args.price
          ? `Referência de valor na página oficial: ${args.price}.`
          : "";

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

export async function importPresellFromProductUrl(input: ImportPresellInput): Promise<ImportPresellResult> {
  assertExternalProductUrl(input.productUrl);

  const response = await fetch(input.productUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": DEFAULT_UA,
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Não foi possível ler a página do produto (${response.status}).`);
  }

  const finalUrl = response.url || input.productUrl;
  assertExternalProductUrl(finalUrl);

  const html = await response.text();
  if (html.length < 800) {
    throw new Error("A página retornou pouco conteúdo. Use o link completo da página de vendas (https://...).");
  }

  if (htmlLooksLikeWrongProduct(html, finalUrl)) {
    throw new Error(
      "O conteúdo obtido parece ser do painel dclickora, não do produto. Cole o link público da oferta (ex.: theneotonics.com/...), não localhost.",
    );
  }

  const language = input.language || "pt";
  const locale = localePack(language);
  const langKey = language.toLowerCase();

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

  const headings = extractHeadings(html);
  const paragraphs = extractParagraphs(html);

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
  const images = extractImages(html, finalUrl);
  const video_url = extractVideoUrl(html, finalUrl);

  const heroTitle = pickHeroTitle(headings, productName);
  const subtitle = pickSubtitle(headings, heroTitle, description, locale);

  const joinedLen = paragraphs.join("").length;
  const sales_text =
    joinedLen >= 900
      ? buildRichSalesText(paragraphs, locale, price, langKey)
      : buildCompactSalesText({
          language,
          productName,
          description: description || productName,
          price,
          paragraphs,
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
    official_buy_cta: officialBuyCta(language),
    ...discount,
    ...(video_url ? { video_url } : {}),
  };
}

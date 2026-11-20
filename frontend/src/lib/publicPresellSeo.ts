import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import type { Presell } from "@/types/api";
import {
  getPresellSeoPrimaryTitle,
  getPresellProductLabel,
  looksLikeAppBrandTitle,
  resolvePublicPresellDocumentTitle,
} from "@/lib/publicPresellDocumentTitle";
import { rankPresellProductImages } from "@/lib/presellProductImagesRank";
import { readMarketCountryHint } from "@/lib/consentMarketPolicy";
import { htmlLangForPresell } from "@/lib/presellUiStrings";

const MAX_META_DESC = 165;

function clampMetaDescription(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > MAX_META_DESC ? `${t.slice(0, MAX_META_DESC - 3)}…` : t;
}

/** Descrição para `meta name="description"` e redes sociais. */
export function resolvePublicPresellMetaDescription(page: Presell): string {
  const c = (page.content || {}) as Record<string, unknown>;
  if (page.type === "builder") {
    const doc = parsePresellBuilderPageDocument(page.content);
    const fromSeo = String(doc?.seo?.description ?? "").trim();
    if (fromSeo) return clampMetaDescription(fromSeo);
  }
  const explicit = String(c.metaDescription ?? c.meta_description ?? "").trim();
  if (explicit) return clampMetaDescription(explicit);
  const sub = String(c.subtitle ?? "").trim();
  if (sub) return clampMetaDescription(sub);
  const salesText = String(c.salesText ?? "").trim();
  if (salesText) {
    const firstPara = salesText.split(/\n\n+/)[0]?.trim() ?? "";
    if (firstPara) return clampMetaDescription(firstPara);
  }
  return clampMetaDescription(getPresellSeoPrimaryTitle(page) || getPresellProductLabel(page));
}

/** Extrai URLs de &lt;img&gt; / srcset do espelho importado (páginas sem `productImages`). */
export function extractProductImageUrlsFromHtml(html: string, baseUrl = ""): string[] {
  const t = html.trim();
  if (t.length < 40) return [];
  let base = baseUrl;
  const baseTag = t.match(/<base\b[^>]*>/i);
  if (baseTag) {
    const href = htmlTagAttr(baseTag[0], "href");
    const abs = href ? absolutizeAgainst(href, baseUrl || "https://example.invalid/") : "";
    if (abs && !abs.includes("example.invalid")) base = abs;
  }
  const found: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const abs = absolutizeAgainst(raw, base);
    if (!abs || !/^https?:\/\//i.test(abs)) return;
    if (looksLikeAppBrandTitle(abs) || /\/favicon\.svg(\?|$)/i.test(abs)) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    found.push(abs);
  };
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(t)) !== null) {
    const tag = m[0];
    const src = htmlTagAttr(tag, "src");
    if (src) push(src);
    const srcset = htmlTagAttr(tag, "srcset");
    if (srcset) {
      for (const part of srcset.split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (u) push(u);
      }
    }
  }
  return found;
}

/** Primeira imagem útil para `og:image` (URL relativo ou absoluto). */
export function resolvePublicPresellOgImageUrl(page: Presell): string | undefined {
  const c = (page.content || {}) as Record<string, unknown>;
  if (page.type === "builder") {
    const doc = parsePresellBuilderPageDocument(page.content);
    const og = String(doc?.seo?.ogImage ?? "").trim();
    if (og) return og;
  }
  const raw = Array.isArray(c.productImages)
    ? (c.productImages as unknown[]).filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : [];
  let ranked = rankPresellProductImages(raw.map((s) => s.trim()));
  if (!ranked[0]) {
    const source = String(c.sourceUrl ?? c.source_url ?? "").trim();
    const mirror =
      typeof c.importMirrorSrcDoc === "string"
        ? c.importMirrorSrcDoc
        : typeof c.import_mirror_src_doc === "string"
          ? c.import_mirror_src_doc
          : "";
    ranked = rankPresellProductImages(extractProductImageUrlsFromHtml(mirror, source));
  }
  return ranked[0]?.trim();
}

function htmlTagAttr(tag: string, name: string): string {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return (m?.[1] || m?.[2] || m?.[3] || "").trim();
}

function absolutizeAgainst(href: string, base: string): string {
  const t = href.trim();
  if (!t || /^(javascript|vbscript):/i.test(t)) return "";
  try {
    return new URL(t, base).href;
  } catch {
    return "";
  }
}

/** Ícone da origem (ou da foto do produto) — nunca o favicon da app. */
export function extractIconHrefFromHtml(html: string, baseUrl = ""): string {
  const t = html.trim();
  if (t.length < 20) return "";
  let base = baseUrl;
  const baseTag = t.match(/<base\b[^>]*>/i);
  if (baseTag) {
    const href = htmlTagAttr(baseTag[0], "href");
    const abs = href ? absolutizeAgainst(href, baseUrl || "https://example.invalid/") : "";
    if (abs && !abs.includes("example.invalid")) base = abs;
  }
  const re = /<link\b[^>]*>/gi;
  let best = "";
  let bestScore = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const tag = m[0];
    const rel = htmlTagAttr(tag, "rel").toLowerCase();
    if (!rel || rel.includes("mask-icon")) continue;
    if (!/\bicon\b/.test(rel) && !rel.includes("apple-touch")) continue;
    const abs = absolutizeAgainst(htmlTagAttr(tag, "href"), base);
    if (!abs || !/^https?:\/\//i.test(abs)) continue;
    if (looksLikeAppBrandTitle(abs) || /\/favicon\.svg(\?|$)/i.test(abs)) continue;
    let score = 10;
    if (rel.includes("apple-touch")) score += 40;
    if (/\.png(\?|$)/i.test(abs)) score += 22;
    if (/\.webp(\?|$)/i.test(abs)) score += 16;
    if (/\.jpe?g(\?|$)/i.test(abs)) score += 12;
    if (/\.ico(\?|$)/i.test(abs)) score += 6;
    const sizes = htmlTagAttr(tag, "sizes");
    const sizeN = Number.parseInt(sizes, 10);
    if (sizeN >= 180) score += 28;
    else if (sizeN >= 64) score += 16;
    if (score > bestScore) {
      bestScore = score;
      best = abs;
    }
  }
  return best;
}

function mimeForIconHref(href: string): string {
  const p = href.split("?")[0].toLowerCase();
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".ico")) return "image/x-icon";
  return "";
}

/** Favicon público: SEO do editor → import → ícone no espelho → white-label tenant → foto do produto. */
export function resolvePublicPresellFaviconUrl(page: Presell): string | undefined {
  const c = (page.content || {}) as Record<string, unknown>;
  const doc = parsePresellBuilderPageDocument(page.content);
  const fromSeo = String(doc?.seo?.favicon ?? "").trim();
  if (fromSeo && !looksLikeAppBrandTitle(fromSeo) && !/\/favicon\.svg(\?|$)/i.test(fromSeo)) {
    return fromSeo;
  }
  const stored = String(c.faviconUrl ?? c.favicon_url ?? "").trim();
  if (stored && !looksLikeAppBrandTitle(stored) && !/\/favicon\.svg(\?|$)/i.test(stored)) {
    return stored;
  }
  const source = String(c.sourceUrl ?? c.source_url ?? "").trim();
  const mirror =
    typeof c.importMirrorSrcDoc === "string"
      ? c.importMirrorSrcDoc
      : typeof c.import_mirror_src_doc === "string"
        ? c.import_mirror_src_doc
        : "";
  const fromMirror = extractIconHrefFromHtml(mirror, source);
  if (fromMirror) return fromMirror;
  const tenantIcon = String(page.tenant_branding?.favicon_url ?? page.tenant_branding?.logo_url ?? "").trim();
  if (tenantIcon && !looksLikeAppBrandTitle(tenantIcon) && !/\/favicon\.svg(\?|$)/i.test(tenantIcon)) {
    return tenantIcon;
  }
  return resolvePublicPresellOgImageUrl(page);
}

export function toAbsolutePageUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return t;
  if (typeof window === "undefined") return t;
  try {
    return new URL(t, window.location.origin).href;
  } catch {
    return t;
  }
}

/**
 * Landers de campanha (ads / tracking) NÃO devem aparecer no Google/Bing/Edge.
 * Indexação só com opt-in explícito no editor (`seo.allowSearchIndexing`).
 */
function robotsDirective(page: Presell): string {
  if (page.status !== "published") return "noindex, nofollow";
  if (page.type === "builder") {
    const doc = parsePresellBuilderPageDocument(page.content);
    const seo = doc?.seo;
    if (seo?.allowSearchIndexing === true && seo?.noindex !== true) {
      return "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
    }
  }
  return "noindex, nofollow";
}

export type PublicPresellHeadSnapshot = {
  title: string;
  metaDescription: string | null;
  metaRobots: string | null;
  metaKeywords: string | null;
  metaAuthor: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  ogType: string | null;
  ogLocale: string | null;
  ogSiteName: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  appleAppTitle: string | null;
  originalIconHtml: string[];
};

/** `en-US` → `en_US` para Open Graph. */
export function ogLocaleFromHtmlLang(htmlLang: string): string {
  const t = htmlLang.trim().replace(/-/g, "_");
  if (/^[a-z]{2}_[A-Z]{2}$/.test(t)) return t;
  if (/^[a-z]{2}$/i.test(t)) {
    const lang = t.toLowerCase();
    // Sem mercado: EN Ads default US (CA/AU/GB passam por htmlLangForPresell).
    if (lang === "en") return "en_US";
    return `${lang}_${lang.toUpperCase()}`;
  }
  return "en_US";
}

export function resolvePublicPresellOgLocale(page: Presell): string {
  const market = readMarketCountryHint(
    (page.settings || {}) as Record<string, unknown>,
    (page.content || {}) as Record<string, unknown>,
  );
  return ogLocaleFromHtmlLang(htmlLangForPresell(page.language, market));
}

function attr(sel: string): string | null {
  return document.querySelector(sel)?.getAttribute("content");
}

const APP_ICON_SEL = 'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';

export function capturePublicPresellHeadSnapshot(): PublicPresellHeadSnapshot {
  return {
    title: document.title,
    metaDescription: attr('meta[name="description"]'),
    metaRobots: attr('meta[name="robots"]'),
    metaKeywords: attr('meta[name="keywords"]'),
    metaAuthor: attr('meta[name="author"]'),
    ogTitle: attr('meta[property="og:title"]'),
    ogDescription: attr('meta[property="og:description"]'),
    ogImage: attr('meta[property="og:image"]'),
    ogUrl: attr('meta[property="og:url"]'),
    ogType: attr('meta[property="og:type"]'),
    ogLocale: attr('meta[property="og:locale"]'),
    ogSiteName: attr('meta[property="og:site_name"]'),
    twitterCard: attr('meta[name="twitter:card"]'),
    twitterTitle: attr('meta[name="twitter:title"]'),
    twitterDescription: attr('meta[name="twitter:description"]'),
    twitterImage: attr('meta[name="twitter:image"]'),
    appleAppTitle: attr('meta[name="apple-mobile-web-app-title"]'),
    originalIconHtml: [...document.querySelectorAll<HTMLLinkElement>(APP_ICON_SEL)]
      .filter((el) => el.getAttribute("data-presell-icon") !== "1")
      .map((el) => el.outerHTML),
  };
}

function restoreMeta(attrName: "name" | "property", key: string, value: string | null) {
  const sel =
    attrName === "name" ? `meta[name="${key}"]` : `meta[property="${key}"]`;
  const el = document.querySelector(sel) as HTMLMetaElement | null;
  if (value == null) {
    el?.remove();
    return;
  }
  if (!el) {
    const m = document.createElement("meta");
    m.setAttribute(attrName, key);
    document.head.appendChild(m);
  }
  document.querySelector(sel)?.setAttribute("content", value);
}

function setMetaName(key: string, value: string) {
  let el = document.querySelector(`meta[name="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setMetaProperty(key: string, value: string) {
  let el = document.querySelector(`meta[property="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
  link.setAttribute("data-presell-seo", "1");
}

function setJsonLd(json: object) {
  const prev = document.querySelector('script[type="application/ld+json"][data-presell-seo]');
  prev?.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-presell-seo", "1");
  script.textContent = JSON.stringify(json);
  document.head.appendChild(script);
}

function removeJsonLd() {
  document.querySelector('script[type="application/ld+json"][data-presell-seo]')?.remove();
}

function restorePresellIcons(s: PublicPresellHeadSnapshot) {
  document.querySelectorAll('link[data-presell-icon="1"]').forEach((el) => el.remove());
  document.querySelectorAll(APP_ICON_SEL).forEach((el) => {
    if (el.getAttribute("data-presell-icon") === "1") return;
    el.remove();
  });
  if (s.originalIconHtml.length > 0) {
    for (const html of s.originalIconHtml) {
      document.head.insertAdjacentHTML("beforeend", html);
    }
  } else {
    const fallback = document.createElement("link");
    fallback.rel = "icon";
    fallback.href = "/favicon.svg";
    fallback.type = "image/svg+xml";
    document.head.appendChild(fallback);
  }
  restoreMeta("name", "apple-mobile-web-app-title", s.appleAppTitle);
}

function applyPresellProductIcons(href: string, shortName: string) {
  const abs = toAbsolutePageUrl(href);
  if (!abs) return;
  document.querySelectorAll(APP_ICON_SEL).forEach((el) => el.remove());
  const type = mimeForIconHref(abs);
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = abs;
  if (type) icon.type = type;
  icon.setAttribute("data-presell-icon", "1");
  document.head.appendChild(icon);
  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = abs;
  apple.setAttribute("sizes", "180x180");
  apple.setAttribute("data-presell-icon", "1");
  document.head.appendChild(apple);
  if (shortName) setMetaName("apple-mobile-web-app-title", shortName.slice(0, 40));
}

export function restorePublicPresellHeadSnapshot(s: PublicPresellHeadSnapshot) {
  removeJsonLd();
  document.querySelector('link[rel="canonical"][data-presell-seo]')?.remove();
  document.title = s.title;
  restoreMeta("name", "description", s.metaDescription);
  restoreMeta("name", "robots", s.metaRobots);
  restoreMeta("name", "keywords", s.metaKeywords);
  restoreMeta("name", "author", s.metaAuthor);
  restoreMeta("property", "og:title", s.ogTitle);
  restoreMeta("property", "og:description", s.ogDescription);
  restoreMeta("property", "og:image", s.ogImage);
  restoreMeta("property", "og:url", s.ogUrl);
  restoreMeta("property", "og:type", s.ogType);
  restoreMeta("property", "og:locale", s.ogLocale);
  restoreMeta("property", "og:site_name", s.ogSiteName);
  restoreMeta("name", "twitter:card", s.twitterCard);
  restoreMeta("name", "twitter:title", s.twitterTitle);
  restoreMeta("name", "twitter:description", s.twitterDescription);
  restoreMeta("name", "twitter:image", s.twitterImage);
  restorePresellIcons(s);
}

/** Remove metas de marketing SaaS que vazam em landers /p/. */
export function stripSaasMarketingMetasFromHead(): void {
  for (const sel of [
    'meta[name="keywords"]',
    'meta[name="author"]',
    'meta[property="og:site_name"]',
  ]) {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  }
}

/**
 * Atualiza `<title>`, meta sociais, canonical (sem query string) e JSON-LD `WebPage`.
 * Devolve função para repor o estado capturado antes da aplicação.
 */
export function applyPublicPresellHeadMetadata(page: Presell): () => void {
  const before = capturePublicPresellHeadSnapshot();

  const canonical = (() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    u.hash = "";
    u.search = "";
    return u.toString();
  })();

  setCanonical(canonical);

  const title = resolvePublicPresellDocumentTitle(page);
  const description = resolvePublicPresellMetaDescription(page);
  const ogImageRaw = resolvePublicPresellOgImageUrl(page);
  const ogImageAbs = ogImageRaw ? toAbsolutePageUrl(ogImageRaw) : "";
  const faviconRaw = resolvePublicPresellFaviconUrl(page);
  const robots = robotsDirective(page);
  const primary = getPresellSeoPrimaryTitle(page);
  const productLabel = getPresellProductLabel(page);

  document.title = title;
  if (faviconRaw) applyPresellProductIcons(faviconRaw, productLabel);
  stripSaasMarketingMetasFromHead();
  setMetaName("description", description);
  setMetaName("robots", robots);
  setMetaProperty("og:type", "website");
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  if (canonical) setMetaProperty("og:url", canonical);
  if (ogImageAbs) {
    setMetaProperty("og:image", ogImageAbs);
  } else {
    restoreMeta("property", "og:image", null);
  }
  const siteName = String(page.tenant_branding?.brand_name ?? "").trim();
  // Só white-label do tenant — nunca deixar og:site_name=dclickora do shell.
  if (siteName && !looksLikeAppBrandTitle(siteName)) {
    setMetaProperty("og:site_name", siteName);
  } else {
    restoreMeta("property", "og:site_name", null);
  }
  setMetaProperty("og:locale", resolvePublicPresellOgLocale(page));

  const twitterCard = ogImageAbs ? "summary_large_image" : "summary";
  setMetaName("twitter:card", twitterCard);
  setMetaName("twitter:title", title);
  setMetaName("twitter:description", description);
  if (ogImageAbs) {
    setMetaName("twitter:image", ogImageAbs);
  } else {
    restoreMeta("name", "twitter:image", null);
  }

  setJsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: primary,
    description,
    url: canonical || undefined,
    ...(ogImageAbs ? { image: ogImageAbs } : {}),
  });

  return () => {
    restorePublicPresellHeadSnapshot(before);
  };
}

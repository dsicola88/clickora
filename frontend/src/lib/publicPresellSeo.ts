import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import type { Presell } from "@/types/api";
import {
  getPresellSeoPrimaryTitle,
  getPresellProductLabel,
  resolvePublicPresellDocumentTitle,
} from "@/lib/publicPresellDocumentTitle";

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

/** Primeira imagem útil para `og:image` (URL relativo ou absoluto). */
export function resolvePublicPresellOgImageUrl(page: Presell): string | undefined {
  const c = (page.content || {}) as Record<string, unknown>;
  if (page.type === "builder") {
    const doc = parsePresellBuilderPageDocument(page.content);
    const og = String(doc?.seo?.ogImage ?? "").trim();
    if (og) return og;
  }
  const images = Array.isArray(c.productImages) ? (c.productImages as unknown[]) : [];
  const first = images.find((u): u is string => typeof u === "string" && u.trim().length > 0);
  return first?.trim();
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

function robotsDirective(page: Presell): string {
  if (page.status !== "published") return "noindex, nofollow";
  return "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
}

export type PublicPresellHeadSnapshot = {
  title: string;
  metaDescription: string | null;
  metaRobots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  ogType: string | null;
  ogLocale: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
};

function attr(sel: string): string | null {
  return document.querySelector(sel)?.getAttribute("content");
}

export function capturePublicPresellHeadSnapshot(): PublicPresellHeadSnapshot {
  return {
    title: document.title,
    metaDescription: attr('meta[name="description"]'),
    metaRobots: attr('meta[name="robots"]'),
    ogTitle: attr('meta[property="og:title"]'),
    ogDescription: attr('meta[property="og:description"]'),
    ogImage: attr('meta[property="og:image"]'),
    ogUrl: attr('meta[property="og:url"]'),
    ogType: attr('meta[property="og:type"]'),
    ogLocale: attr('meta[property="og:locale"]'),
    twitterCard: attr('meta[name="twitter:card"]'),
    twitterTitle: attr('meta[name="twitter:title"]'),
    twitterDescription: attr('meta[name="twitter:description"]'),
    twitterImage: attr('meta[name="twitter:image"]'),
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

export function restorePublicPresellHeadSnapshot(s: PublicPresellHeadSnapshot) {
  removeJsonLd();
  document.querySelector('link[rel="canonical"][data-presell-seo]')?.remove();
  document.title = s.title;
  restoreMeta("name", "description", s.metaDescription);
  restoreMeta("name", "robots", s.metaRobots);
  restoreMeta("property", "og:title", s.ogTitle);
  restoreMeta("property", "og:description", s.ogDescription);
  restoreMeta("property", "og:image", s.ogImage);
  restoreMeta("property", "og:url", s.ogUrl);
  restoreMeta("property", "og:type", s.ogType);
  restoreMeta("property", "og:locale", s.ogLocale);
  restoreMeta("name", "twitter:card", s.twitterCard);
  restoreMeta("name", "twitter:title", s.twitterTitle);
  restoreMeta("name", "twitter:description", s.twitterDescription);
  restoreMeta("name", "twitter:image", s.twitterImage);
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
  const robots = robotsDirective(page);
  const primary = getPresellSeoPrimaryTitle(page);

  document.title = title;
  setMetaName("description", description);
  setMetaName("robots", robots);
  setMetaProperty("og:type", "website");
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  if (canonical) setMetaProperty("og:url", canonical);
  if (ogImageAbs) setMetaProperty("og:image", ogImageAbs);
  setMetaProperty("og:locale", "pt_BR");

  const twitterCard = ogImageAbs ? "summary_large_image" : "summary";
  setMetaName("twitter:card", twitterCard);
  setMetaName("twitter:title", title);
  setMetaName("twitter:description", description);
  if (ogImageAbs) setMetaName("twitter:image", ogImageAbs);

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

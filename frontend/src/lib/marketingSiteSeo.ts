import { getPublicPresellOrigin } from "@/lib/publicPresellOrigin";

/**
 * Cópia alinhada a pesquisas orgânicas (presell, tracking, conversões, afiliados).
 * Manter sincronizado com `frontend/index.html` para bots que não executam JS.
 */
export const MARKETING_DEFAULT_TITLE =
  "dclickora — Presell pages, rastreamento de conversões e ferramenta para afiliados";

export const MARKETING_DEFAULT_DESCRIPTION =
  "Crie presell pages profissionais, rastreie cliques, leads e vendas com links rastreados. Plataforma de tracking, conversões e gestão de URLs para marketing de afiliados digitais.";

const PLANS_TITLE = "Planos e preços — dclickora | Presell, tracking e conversões para afiliados";

const PLANS_DESCRIPTION =
  "Compare planos dclickora: presell pages, rastreador de cliques e conversões, links rastreados e relatórios para afiliados e marketing de performance.";

/** Landing com intenção comercial — presell / afiliados. */
const INTENT_PRESELL_TITLE =
  "Presell pages para afiliados — criar páginas que convertem | dclickora";

const INTENT_PRESELL_DESCRIPTION =
  "Ferramenta de presell com editor, VSL, prova social e CTA rastreado. Ideal para afiliados que precisam de página de pré-venda profissional e mensagem alinhada ao tráfego pago.";

/** Landing com intenção comercial — tracking / ROI. */
const INTENT_TRACKING_TITLE =
  "Rastreamento de conversões, cliques e links para afiliados | dclickora";

const INTENT_TRACKING_DESCRIPTION =
  "Rastreador de cliques e UTMs, relatórios e integrações num painel. Para afiliados e media buyers que querem medir ROI de presells, campanhas e links em tempo real.";

/** Página-recurso (guia) — cobre várias queries long-tail num só URL. */
const GUIDE_TITLE =
  "Guia: criar presell rápido, rastrear cliques e ferramenta para afiliados | dclickora";

const GUIDE_DESCRIPTION =
  "Como criar presell que converte, rastrear cliques no marketing digital, evitar erros comuns e substituir click trackers genéricos. Guia prático para afiliados que usam tráfego pago.";

const AUTH_TITLE = "Entrar ou criar conta — dclickora | Presell e tracking para afiliados";

const AUTH_DESCRIPTION =
  "Aceda à plataforma dclickora: crie presell pages, rastreie conversões e gerencie links de afiliado e campanhas num só lugar.";

export type MarketingHeadSnapshot = {
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

export function captureMarketingHeadSnapshot(): MarketingHeadSnapshot {
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

export function restoreMarketingHeadSnapshot(s: MarketingHeadSnapshot) {
  document.querySelector('link[rel="canonical"][data-marketing-seo]')?.remove();
  document.querySelector('link[rel="alternate"][data-marketing-seo]')?.remove();
  document.querySelector('script[type="application/ld+json"][data-marketing-seo]')?.remove();
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

function resolveSiteOrigin(): string {
  return getPublicPresellOrigin(null).replace(/\/+$/, "");
}

function landingPathInfo(pathname: string): { title: string; description: string } {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/plans" || p === "/planos") {
    return { title: PLANS_TITLE, description: PLANS_DESCRIPTION };
  }
  if (p === "/presell-para-afiliados") {
    return { title: INTENT_PRESELL_TITLE, description: INTENT_PRESELL_DESCRIPTION };
  }
  if (p === "/rastreamento-afiliados") {
    return { title: INTENT_TRACKING_TITLE, description: INTENT_TRACKING_DESCRIPTION };
  }
  if (p === "/guia-vendas-afiliados") {
    return { title: GUIDE_TITLE, description: GUIDE_DESCRIPTION };
  }
  return { title: MARKETING_DEFAULT_TITLE, description: MARKETING_DEFAULT_DESCRIPTION };
}

function canonicalWithoutSearchHash(): string {
  const u = new URL(window.location.href);
  u.hash = "";
  u.search = "";
  return u.toString();
}

/**
 * SEO para `/`, `/plans`, `/planos` (componente `Plans`).
 */
export function applyMarketingLandingHead(pathname: string): () => void {
  const before = captureMarketingHeadSnapshot();
  const origin = resolveSiteOrigin();
  const { title, description } = landingPathInfo(pathname);
  const canonical = canonicalWithoutSearchHash();
  const ogImageAbs = `${origin}/placeholder.svg`;
  const robots = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const pathNorm = pathname.replace(/\/+$/, "") || "/";
  const isGuideArticle = pathNorm === "/guia-vendas-afiliados";

  document.title = title;
  setMetaName("description", description);
  setMetaName("robots", robots);
  setMetaProperty("og:type", isGuideArticle ? "article" : "website");
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  setMetaProperty("og:url", canonical);
  setMetaProperty("og:locale", "pt_BR");
  setMetaProperty("og:image", ogImageAbs);
  setMetaProperty("og:site_name", "dclickora");
  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", title);
  setMetaName("twitter:description", description);
  setMetaName("twitter:image", ogImageAbs);

  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", canonical);
  link.setAttribute("data-marketing-seo", "1");

  const hreflang = document.createElement("link");
  hreflang.setAttribute("rel", "alternate");
  hreflang.setAttribute("hreflang", "pt-BR");
  hreflang.setAttribute("href", canonical);
  hreflang.setAttribute("data-marketing-seo", "1");
  document.head.appendChild(hreflang);

  const jsonLd = JSON.stringify(
    isGuideArticle
      ? buildGuideArticleJsonLd(origin, title, description, canonical)
      : buildMarketingJsonLd(origin, title, description, canonical),
  ).replace(/</g, "\\u003c");
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-marketing-seo", "1");
  script.textContent = jsonLd;
  document.head.appendChild(script);

  return () => restoreMarketingHeadSnapshot(before);
}

/**
 * SEO para `/auth` (sem query na canonical).
 */
export function applyMarketingAuthHead(): () => void {
  const before = captureMarketingHeadSnapshot();
  const origin = resolveSiteOrigin();
  const canonical = `${origin}/auth`;
  const ogImageAbs = `${origin}/placeholder.svg`;
  const robots = "index, follow, max-image-preview:large";

  document.title = AUTH_TITLE;
  setMetaName("description", AUTH_DESCRIPTION);
  setMetaName("robots", robots);
  setMetaProperty("og:type", "website");
  setMetaProperty("og:title", AUTH_TITLE);
  setMetaProperty("og:description", AUTH_DESCRIPTION);
  setMetaProperty("og:url", canonical);
  setMetaProperty("og:locale", "pt_BR");
  setMetaProperty("og:image", ogImageAbs);
  setMetaProperty("og:site_name", "dclickora");
  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", AUTH_TITLE);
  setMetaName("twitter:description", AUTH_DESCRIPTION);
  setMetaName("twitter:image", ogImageAbs);

  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", canonical);
  link.setAttribute("data-marketing-seo", "1");

  const jsonLd = JSON.stringify(
    buildMarketingJsonLd(origin, AUTH_TITLE, AUTH_DESCRIPTION, canonical),
  ).replace(/</g, "\\u003c");
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-marketing-seo", "1");
  script.textContent = jsonLd;
  document.head.appendChild(script);

  return () => restoreMarketingHeadSnapshot(before);
}

function buildGuideArticleJsonLd(
  origin: string,
  headline: string,
  description: string,
  pageUrl: string,
): { "@context": string; "@graph": Record<string, unknown>[] } {
  const orgId = `${origin}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "dclickora",
        url: origin,
        logo: {
          "@type": "ImageObject",
          url: `${origin}/favicon.svg`,
        },
      },
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline,
        description,
        url: pageUrl,
        inLanguage: "pt-BR",
        author: { "@id": orgId },
        publisher: { "@id": orgId },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": pageUrl,
        },
      },
    ],
  };
}

function buildMarketingJsonLd(
  origin: string,
  name: string,
  description: string,
  pageUrl: string,
): { "@context": string; "@graph": Record<string, unknown>[] } {
  const orgId = `${origin}/#organization`;
  const siteId = `${origin}/#website`;
  const appId = `${origin}/#software`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "dclickora",
        url: origin,
        logo: {
          "@type": "ImageObject",
          url: `${origin}/favicon.svg`,
        },
      },
      {
        "@type": "WebSite",
        "@id": siteId,
        url: origin,
        name: "dclickora",
        description: MARKETING_DEFAULT_DESCRIPTION,
        inLanguage: "pt-BR",
        publisher: { "@id": orgId },
      },
      {
        "@type": "SoftwareApplication",
        "@id": appId,
        name: "dclickora",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description,
        url: pageUrl,
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          url: `${origin}/planos`,
        },
        publisher: { "@id": orgId },
      },
    ],
  };
}

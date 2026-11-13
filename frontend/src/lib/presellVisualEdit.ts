import { createSection, createWidget, id } from "@/page-builder/factory";
import type { PageDocument, WidgetNode } from "@/page-builder/types";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { resolvePresellGenerationNiche } from "@/lib/presellGenerationNiche";
import { CLICKORA_MIRROR_TRACK_MARKER } from "@/lib/presellMirrorMarkers";
import { bakeHtmlOfferHrefs } from "@/lib/presellOfferHrefBake";
import {
  getPresellGateKind,
  isVideoPresellType,
  isVslOnlyPresellType,
} from "@/lib/presellTypeMeta";
import { getPresellTypeTheme } from "@/lib/presellTypeTheme";
import { resolveHealthArticle } from "@/lib/presellHealthArticle";
import { getPresellUiStrings } from "@/lib/presellUiStrings";
import { isPresellDecorImage, rankPresellProductImages } from "@/lib/presellProductImagesRank";
import { resolvePresellPortalBrandName } from "@/lib/presellDisplayName";
function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function photoKey(url: string): string {
  const file = decodeURIComponent(url.split("?")[0].split("/").pop() || url);
  return file.replace(/^\d+px-/i, "").toLowerCase();
}

/** Ícones de interface (cadeado da Wikipédia, SVG, miniaturas de 40px) não são fotos do produto. */
function isUsefulPhoto(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes(".svg")) return false;
  if (/\/(?:20|40|60|80)px-/.test(u)) return false;
  if (/shackle|padlock|ambox|edit-clear|question_book|information_icon|symbol_/.test(u)) return false;
  return true;
}

function imageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let url = "";
    if (typeof item === "string") url = item.trim();
    else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      url = asString(row.url || row.src);
    }
    if (!(/^(https?:\/\/|data:image\/)/i.test(url)) || !isUsefulPhoto(url)) continue;
    const key = photoKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= 6) break;
  }
  return out;
}

function textHtml(subtitle: string, sales: string): string {
  const blocks = [subtitle, sales].map((s) => s.trim()).filter(Boolean);
  if (!blocks.length) return "";
  return blocks
    .map((block) =>
      block
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
        .join(""),
    )
    .join("");
}

export type EditablePresellSource = {
  title: string;
  type?: string;
  videoUrl?: string | null;
  language?: string | null;
  content: Record<string, unknown>;
};

function isWhiteNiche(content: Record<string, unknown>): boolean {
  return resolvePresellGenerationNiche(content) === "white";
}

function heroImageWidget(src: string, alt: string, offer = "", isHero = true): WidgetNode {
  const image = createWidget("image");
  image.content = {
    ...image.content,
    src,
    alt,
    link: offer,
    ...(isHero ? { hero: true } : { portalProduct: true }),
  };
  image.styles = {
    ...image.styles,
    width: { desktop: "100%" },
    align: { desktop: "center" },
    margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
  };
  return image;
}

/** Foto do produto em artigo black — tamanho editorial, não banner full-bleed. */
function articleProductPhoto(src: string, alt: string, offer = ""): WidgetNode {
  const html = createWidget("html");
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" style="display:block;width:100%;max-width:400px;max-height:min(46vh,400px);height:auto;margin:0 auto;object-fit:contain" />`;
  const linked = offer
    ? `<a href="${escapeHtml(offer)}" data-clickora-offer="1" style="display:block;text-decoration:none">${img}</a>`
    : img;
  html.content = {
    ...html.content,
    code:
      `<figure data-presell-portal-photo="1" style="margin:0 auto 1.75rem;max-width:400px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 1px 3px rgba(15,23,42,.06)">${linked}</figure>`,
  };
  return html;
}

function portalCtaAnchor(): WidgetNode {
  const html = createWidget("html");
  html.content = {
    ...html.content,
    code: `<div id="presell-offer-cta" style="scroll-margin-top:88px" aria-hidden="true"></div>`,
  };
  return html;
}

function articleKicker(text: string): WidgetNode {
  const heading = createWidget("heading");
  heading.content = { ...heading.content, text, tag: "p" };
  const typo = heading.styles.typography;
  if (typo?.desktop) {
    heading.styles.typography = {
      ...typo,
      desktop: {
        ...typo.desktop,
        textAlign: "left",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      },
    };
  }
  heading.styles.color = "#64748b";
  heading.styles.margin = {
    desktop: { top: 0, right: 0, bottom: 10, left: 0, unit: "px" },
  };
  return heading;
}

function articleTitle(text: string): WidgetNode {
  const heading = createWidget("heading");
  heading.content = { ...heading.content, text, tag: "h1" };
  const typo = heading.styles.typography;
  if (typo?.desktop) {
    heading.styles.typography = {
      ...typo,
      desktop: {
        ...typo.desktop,
        textAlign: "left",
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: -0.3,
      },
    };
  }
  heading.styles.color = "#0f172a";
  heading.styles.margin = {
    desktop: { top: 0, right: 0, bottom: 18, left: 0, unit: "px" },
  };
  return heading;
}

function articleBodyHtml(article: {
  intro: string;
  pillarsTitle: string;
  pillars: { title: string; body: string }[];
}): string {
  const pillars = article.pillars
    .map(
      (p) =>
        `<div style="margin:0 0 1.4rem 0;padding:0 0 0 0">` +
        `<p style="margin:0 0 0.35rem 0;font-weight:700;color:#0f172a;font-size:1.06rem;line-height:1.4">${escapeHtml(p.title)}</p>` +
        `<p style="margin:0;color:#475569;font-size:1rem;line-height:1.7">${escapeHtml(p.body)}</p>` +
        `</div>`,
    )
    .join("");
  return (
    `<p style="margin:0 0 1.6rem 0;color:#334155;font-size:1.06rem;line-height:1.75">${escapeHtml(article.intro)}</p>` +
    `<h2 style="margin:0 0 1.1rem 0;font-size:1.2rem;font-weight:700;color:#0f172a;line-height:1.35">${escapeHtml(article.pillarsTitle)}</h2>` +
    pillars
  );
}

function articleCopy(html: string): WidgetNode {
  const text = createWidget("text");
  text.content = { ...text.content, html };
  const typo = text.styles.typography;
  if (typo?.desktop) {
    text.styles.typography = {
      ...typo,
      desktop: { ...typo.desktop, textAlign: "left", fontSize: 17, lineHeight: 1.7 },
    };
  }
  text.styles.color = "#334155";
  text.styles.margin = {
    desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" },
  };
  return text;
}

function resolvePortalHeaderTagline(
  content: Record<string, unknown>,
  brand: string,
  language: string | null | undefined,
): string {
  const meta = asString(content.metaDescription || content.meta_description);
  if (meta.length >= 24 && meta.length <= 160 && !/lorem ipsum|click here to/i.test(meta)) {
    return meta.length > 132 ? `${meta.slice(0, 129)}…` : meta;
  }
  const subtitle = asString(content.subtitle);
  if (subtitle.length >= 20 && subtitle.length <= 140) {
    return subtitle.length > 132 ? `${subtitle.slice(0, 129)}…` : subtitle;
  }
  const L = getPresellUiStrings(language || "en");
  return L.portalHeaderTagline.replaceAll("{name}", brand);
}

/** Barra superior — black = portal navy; white sem espelho = chrome limpo de produto. */
function portalHeaderWidget(
  brand: string,
  tagline: string,
  ctaLabel: string,
  offer: string,
  mode: "black" | "white" = "black",
): WidgetNode {
  const html = createWidget("html");
  const isScroll = offer.startsWith("#");
  const cta =
    offer && ctaLabel
      ? `<a href="${escapeHtml(offer)}"${isScroll ? "" : ' data-clickora-offer="1"'} style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-width:9.5rem;padding:12px 22px;border-radius:10px;background:#0d9488;color:#fff;font-size:14px;font-weight:700;text-decoration:none;white-space:nowrap;box-shadow:0 10px 24px -12px rgba(13,148,136,.55);letter-spacing:.01em">${escapeHtml(ctaLabel)}</a>`
      : "";
  const isWhite = mode === "white";
  const kicker = isWhite ? "Página do produto" : "Portal editorial";
  const headerBg = isWhite ? "#ffffff" : "#0f172a";
  const brandColor = isWhite ? "#0f172a" : "#fff";
  const tagColor = isWhite ? "#475569" : "rgba(255,255,255,.84)";
  const kickerColor = isWhite ? "#0f766e" : "#5eead4";
  const border = isWhite ? "border-bottom:1px solid #e2e8f0" : "border-bottom:1px solid rgba(255,255,255,.08)";
  html.content = {
    ...html.content,
    code:
      `<header style="display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:18px clamp(16px,4vw,28px);background:${headerBg};color:${brandColor};font-family:Georgia,'Times New Roman',serif;${border}">` +
      `<div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 14rem">` +
      `<span style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${kickerColor}">${kicker}</span>` +
      `<span style="font-size:clamp(1.2rem,3vw,1.55rem);font-weight:700;letter-spacing:-0.02em;line-height:1.2;color:${brandColor};font-family:Georgia,'Times New Roman',serif">${escapeHtml(brand)}</span>` +
      `<span style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:clamp(0.75rem,2.1vw,0.875rem);font-weight:500;color:${tagColor};line-height:1.45;max-width:42rem">${escapeHtml(tagline)}</span>` +
      `</div>` +
      cta +
      `</header>`,
  };
  return html;
}

/** Artigo editorial partilhado (black portal / white sem espelho). */
function pushEditorialArticleSections(args: {
  sections: ReturnType<typeof createSection>[];
  content: Record<string, unknown>;
  title: string;
  sourceTitle: string;
  language: string | null | undefined;
  cta: string;
  offer: string;
  offerForCtas: string;
  cookieType: boolean;
  hero: string | undefined;
  restImages: string[];
  videoUrl: string;
  mode: "black" | "white";
  /** Tipo da presell — VSL põe vídeo primeiro; VSL puro omite carta longa. */
  presellType?: string;
}) {
  const {
    sections,
    content,
    title,
    sourceTitle,
    language,
    cta,
    offer,
    offerForCtas,
    cookieType,
    hero,
    restImages,
    videoUrl,
    mode,
    presellType = "",
  } = args;
  const vslFocus = isVideoPresellType(presellType);
  const vslOnly = isVslOnlyPresellType(presellType);
  const sourcePageTitle =
    asString(content.sourcePageTitle) || asString(content.source_page_title);
  const portalBrand = resolvePresellPortalBrandName({
    productName: asString(content.productName) || asString(content.product_name),
    contentTitle: asString(content.title),
    sourcePageTitle,
    pageTitle: sourceTitle || title,
  });
  const portalLang = language || asString(content.language) || "en";
  const headerTagline = resolvePortalHeaderTagline(content, portalBrand, portalLang);
  const typeTheme = getPresellTypeTheme(presellType);
  const contentForArticle: Record<string, unknown> = { ...content };
  // Selo do tipo (Análise / Artigo / Carta…) quando o content não define kicker próprio.
  if (!asString(content.articleKicker) && !asString(content.healthKicker) && typeTheme.badge) {
    contentForArticle.articleKicker = typeTheme.badge;
  }
  const article = resolveHealthArticle({
    content: contentForArticle,
    productName: portalBrand,
    language: portalLang || "pt-BR",
    salesText: asString(content.salesText),
    ctaText: cta,
  });
  const ctaLabel = article.ctaLabel || cta || "Continuar";
  const offerLink = offerForCtas;
  const headerCtaHref = offerForCtas || (cookieType ? "#presell-offer-cta" : "");
  const headerCtaLabel =
    cookieType && !offerForCtas
      ? getPresellUiStrings(portalLang).portalHeaderOffer
      : ctaLabel;

  const headerSec = createSection(1);
  headerSec.layout = "full";
  headerSec.contentWidth = 960;
  headerSec.styles = {
    ...headerSec.styles,
    padding: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
    background: mode === "white" ? "#ffffff" : "#0f172a",
  };
  headerSec.columns[0].widgets = [
    portalHeaderWidget(portalBrand, headerTagline, headerCtaLabel, headerCtaHref, mode),
  ];
  sections.push(headerSec);

  const pushVideoSection = () => {
    if (!videoUrl) return;
    const video = createWidget("video");
    const isFile = /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(videoUrl);
    video.content = {
      ...video.content,
      url: videoUrl,
      provider: isFile ? "file" : "youtube",
      controls: true,
      autoplay: false,
    };
    const vidSec = createSection(1);
    vidSec.contentWidth = vslFocus ? 960 : 720;
    vidSec.styles = {
      ...vidSec.styles,
      padding: {
        desktop: {
          top: vslFocus ? 16 : 0,
          right: 28,
          bottom: vslFocus ? 20 : 16,
          left: 28,
          unit: "px",
        },
      },
      background: vslFocus && mode === "black" ? "#0f172a" : "#ffffff",
    };
    vidSec.columns[0].widgets = [video];
    sections.push(vidSec);
  };

  // VSL: vídeo antes do texto. VSL puro: kicker+título+CTA, sem carta longa.
  if (vslFocus) pushVideoSection();
  if (vslFocus && !videoUrl) {
    const note = createWidget("text");
    const pt = (portalLang || "").toLowerCase().startsWith("pt");
    note.content = {
      ...note.content,
      html: pt
        ? "<p><strong>Vídeo:</strong> adicione a URL do vídeo na presell para o visitante ver a VSL completa.</p>"
        : "<p><strong>Video:</strong> add a video URL on this presell so visitors see the full VSL.</p>",
    };
    const noteSec = createSection(1);
    noteSec.contentWidth = 720;
    noteSec.styles = {
      ...noteSec.styles,
      padding: { desktop: { top: 12, right: 28, bottom: 8, left: 28, unit: "px" } },
      background: mode === "black" ? "#0f172a" : "#ffffff",
    };
    noteSec.columns[0].widgets = [note];
    sections.push(noteSec);
  }

  const articleSec = createSection(1);
  articleSec.layout = "full";
  articleSec.contentWidth = 720;
  articleSec.styles = {
    ...articleSec.styles,
    padding: { desktop: { top: 28, right: 28, bottom: 8, left: 28, unit: "px" } },
    margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
    background: "#ffffff",
  };
  const articleWidgets: WidgetNode[] = [
    articleKicker(article.kicker),
    articleTitle(article.headline),
  ];
  if (!vslOnly && hero) articleWidgets.push(articleProductPhoto(hero, portalBrand, offerLink));
  if (!vslOnly) articleWidgets.push(articleCopy(articleBodyHtml(article)));
  articleSec.columns[0].widgets = articleWidgets;
  sections.push(articleSec);

  if (!vslFocus) pushVideoSection();

  if (offer) {
    const ctaSec = createSection(1);
    ctaSec.layout = "boxed";
    ctaSec.contentWidth = 680;
    ctaSec.styles = {
      ...ctaSec.styles,
      padding: { desktop: { top: 22, right: 24, bottom: 24, left: 24, unit: "px" } },
      margin: { desktop: { top: 4, right: 20, bottom: 36, left: 20, unit: "px" } },
      background: "#f8fafc",
      border: { width: 1, style: "solid", color: "#e2e8f0", radius: 14 },
    };
    ctaSec.columns[0].widgets = [
      portalCtaAnchor(),
      portalCtaNote(article.productNote),
      portalOfferButton(ctaLabel, offer),
    ];
    sections.push(ctaSec);
  }

  if (restImages.length) {
    const galleryWidgets = restImages
      .filter((src) => !isPresellDecorImage(src))
      .slice(0, 1)
      .map((src) => articleProductPhoto(src, portalBrand, offerLink));
    const gallery = createSection(1);
    gallery.contentWidth = 720;
    gallery.styles = {
      ...gallery.styles,
      padding: { desktop: { top: 0, right: 28, bottom: 36, left: 28, unit: "px" } },
      background: "#f8fafc",
    };
    if (galleryWidgets.length) {
      gallery.columns[0].widgets = galleryWidgets;
      sections.push(gallery);
    }
  }
}

function portalCtaNote(note: string): WidgetNode {
  const text = createWidget("text");
  text.content = {
    ...text.content,
    html: `<p style="margin:0 0 1rem 0;color:#475569;font-size:0.98rem;line-height:1.7">${escapeHtml(note)}</p>`,
  };
  const typo = text.styles.typography;
  if (typo?.desktop) {
    text.styles.typography = {
      ...typo,
      desktop: { ...typo.desktop, textAlign: "left", fontSize: 16, lineHeight: 1.7 },
    };
  }
  text.styles.color = "#475569";
  return text;
}

function portalOfferButton(label: string, offer: string): WidgetNode {
  const button = createWidget("button");
  button.content = { ...button.content, text: label, href: offer, target: "_self", offerPrimary: true };
  button.styles = {
    ...button.styles,
    color: "#ffffff",
    background: "#0d9488",
    align: { desktop: "center" },
    width: { desktop: "100%" },
    padding: { desktop: { top: 16, right: 32, bottom: 16, left: 32, unit: "px" } },
    border: { width: 0, style: "solid", color: "#000000", radius: 10 },
    margin: { desktop: { top: 8, right: 0, bottom: 0, left: 0, unit: "px" } },
    boxShadow: "0 12px 28px -14px rgba(13, 148, 136, 0.55)",
  };
  const typo = button.styles.typography;
  if (typo?.desktop) {
    button.styles.typography = {
      ...typo,
      desktop: { ...typo.desktop, fontSize: 19, fontWeight: 800, textAlign: "center", lineHeight: 1.25 },
    };
  }
  return button;
}

function sanitizeImportedHtml(html: string, keepStylesheets = false): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, "");
  if (keepStylesheets) {
    out = out.replace(/<link\b(?![^>]*rel\s*=\s*['"][^'"]*stylesheet)[^>]*>/gi, "");
  } else {
    out = out.replace(/<link\b[^>]*>/gi, "");
  }
  return out;
}

function policyHrefFromContent(_content: Record<string, unknown>): string {
  return "/privacidade";
}

function attrUrl(tag: string, attr: string): string {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return (m?.[2] ?? m?.[3] ?? "").trim();
}

function absolutizeHref(href: string, base: string): string {
  if (!href || /^(https?:|data:|mailto:|tel:|#)/i.test(href)) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function withAbsoluteAttr(tag: string, attr: string, base: string): string {
  const raw = attrUrl(tag, attr);
  if (!raw) return tag;
  const abs = absolutizeHref(raw, base);
  if (abs === raw) return tag;
  return tag.replace(
    new RegExp(`${attr}\\s*=\\s*("(?:[^"]*)"|'(?:[^']*)')`, "i"),
    `${attr}="${abs.replace(/"/g, "&quot;")}"`,
  );
}

/** Absolutiza src/href relativos no markup (antes do bake público neutralizar &lt;base&gt;). */
function absolutizeBodyAssets(html: string, base: string): string {
  if (!base) return html;
  let out = html.replace(
    /<(img|source|a|video|audio|iframe|link)\b([^>]*)>/gi,
    (_full, tag: string, attrs: string) => {
      let next = `<${tag}${attrs}>`;
      for (const attr of ["src", "href", "poster", "data-src", "data-lazy-src"]) {
        if (new RegExp(`\\b${attr}\\s*=`, "i").test(attrs)) {
          next = withAbsoluteAttr(next, attr, base);
        }
      }
      return next;
    },
  );
  // url() em <style> / style="" — o bake anula <base href> do merchant.
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _q: string, raw: string) => {
    const abs = absolutizeHref(raw, base);
    if (!abs || abs === raw || abs.startsWith("data:")) return full;
    return `url(${abs})`;
  });
  return out;
}

/** CSS da origem (base + stylesheets + <style>) e o corpo — visual fiel no HTML widget. */
export function mirrorSrcDocToEditableHtml(srcdoc: string): string {
  const raw = srcdoc.trim();
  if (!raw) return "";
  const baseTag = raw.match(/<base\b[^>]*>/i)?.[0] ?? "";
  const baseHref = attrUrl(baseTag, "href") || "";
  const links = [...raw.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /rel\s*=\s*["'][^"']*stylesheet/i.test(tag))
    .map((tag) => (baseHref ? withAbsoluteAttr(tag, "href", baseHref) : tag));
  const styleTags = [...raw.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join("\n");
  let body = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? raw;
  body = sanitizeImportedHtml(body);
  if (baseHref) body = absolutizeBodyAssets(body, baseHref);
  const head = sanitizeImportedHtml(`${baseTag}${links.join("")}${styleTags}`, true);
  return `${head}${body}`.trim();
}

function foldHeading(title: string, align: "left" | "center"): WidgetNode {
  const heading = createWidget("heading");
  heading.content = { ...heading.content, text: title, tag: "h1" };
  const typo = heading.styles.typography;
  if (typo?.desktop) {
    heading.styles.typography = {
      ...typo,
      desktop: { ...typo.desktop, textAlign: align, fontSize: 52, fontWeight: 800, lineHeight: 1.12 },
    };
  }
  return heading;
}

function foldCopy(html: string): WidgetNode {
  const text = createWidget("text");
  text.content = { ...text.content, html };
  const typo = text.styles.typography;
  if (typo?.desktop) {
    text.styles.typography = {
      ...typo,
      desktop: { ...typo.desktop, textAlign: "left", fontSize: 20, lineHeight: 1.65 },
    };
  }
  return text;
}

function offerCookie(_offer: string, policyHref: string, language?: string | null): WidgetNode {
  const cookie = createWidget("cookieBanner");
  const L = getPresellUiStrings(language || "en");
  cookie.content = {
    ...cookie.content,
    title: L.cookieTitle,
    body: L.cookieBody,
    allowLabel: L.cookieAllow,
    declineLabel: L.cookieClose,
    policyLabel: L.cookiePolicy,
    footerNote: L.cookieFooter,
    followLanguage: false,
    overlayOpacity: 12,
    overlayBlur: 0,
    policyUrl: policyHref || "/privacidade",
  };
  return cookie;
}

/**
 * White: dobra fiel ao produto (espelho ou foto+texto).
 * Black: artigo informativo Ads-safe — sem clonar claims da oferta; hoplink nos CTAs
 * (cookies: banner só desbloqueia; oferta nos botões explícitos).
 */
export function buildEditablePageDocument(source: EditablePresellSource): PageDocument {
  const content = source.content || {};
  const title = asString(content.title) || asString(content.productName) || asString(source.title);
  const html = textHtml(asString(content.subtitle), asString(content.salesText));
  const cta = asString(content.ctaText);
  const offer = asString(content.affiliateLink);
  const images = rankPresellProductImages(imageUrls(content.productImages));
  const productPhotos = images.filter((url) => !isPresellDecorImage(url));
  const alt = asString(content.productName) || title || "Produto";
  const videoUrl = asString(source.videoUrl);
  const white = isWhiteNiche(content);
  const photoPool = productPhotos.length ? productPhotos : white ? images : [];
  const [hero, ...restImages] = photoPool;
  const cookieType = getPresellGateKind(source.type || "") === "cookies";
  const offerForCtas = cookieType ? "" : offer;
  const productFold = white && Boolean(hero);
  const typeId = source.type || "";
  const vslFocus = isVideoPresellType(typeId);
  const vslOnly = isVslOnlyPresellType(typeId);
  const copyWidgets: WidgetNode[] = [];

  const makeVideoWidget = (url: string) => {
    const video = createWidget("video");
    const isFile = /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);
    video.content = {
      ...video.content,
      url,
      provider: isFile ? "file" : "youtube",
      controls: true,
      autoplay: false,
    };
    return video;
  };
  if (vslFocus && videoUrl) copyWidgets.push(makeVideoWidget(videoUrl));
  if (title) copyWidgets.push(foldHeading(title, productFold ? "left" : "center"));
  if (html && !vslOnly) copyWidgets.push(foldCopy(html));
  if (!vslFocus && videoUrl) copyWidgets.push(makeVideoWidget(videoUrl));
  if (cta && offerForCtas) {
    const button = createWidget("button");
    button.content = { ...button.content, text: cta, href: offerForCtas, target: "_self" };
    copyWidgets.push(button);
  }

  const extraPhotos = restImages.map((src) => heroImageWidget(src, alt, offerForCtas, false));
  /** Cookies (white e black): modal só desbloqueia a página — hoplink nos CTAs visíveis (Ads / RGPD). */
  const cookie = cookieType
    ? offerCookie("", policyHrefFromContent(content), source.language)
    : null;

  const sections: ReturnType<typeof createSection>[] = [];
  const mirrorFold = white
    ? mirrorSrcDocToEditableHtml(
        asString(content.importMirrorSrcDoc) || asString(content.import_mirror_src_doc),
      )
    : "";

  let mirrorFoldMode: "faithful" | "blocks" | undefined;
  if (mirrorFold.length > 80) {
    // White «padrão espelho»: sempre HTML fiel (CSS/layout original).
    // Blocos nativos só via conversão explícita no editor — decompor aqui partia Visivra/mwebkivo.
    const pushMirrorFold = () => {
      const htmlW = createWidget("html");
      htmlW.content = { ...htmlW.content, code: mirrorFold, fromMirror: true };
      const fold = createSection(1);
      fold.layout = "full";
      fold.contentWidth = 1200;
      fold.columnGap = { desktop: 0, tablet: 0, mobile: 0 };
      fold.styles = {
        ...fold.styles,
        padding: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
        background: "#ffffff",
      };
      const zeroPad = { top: 0, right: 0, bottom: 0, left: 0, unit: "px" as const };
      fold.columns[0].styles = {
        ...fold.columns[0].styles,
        padding: { desktop: zeroPad, tablet: zeroPad, mobile: zeroPad },
      };
      fold.columns[0].widgets = [htmlW];
      sections.push(fold);
    };
    const pushVideoFold = () => {
      if (!videoUrl) return;
      const video = createWidget("video");
      const isFile = /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(videoUrl);
      video.content = {
        ...video.content,
        url: videoUrl,
        provider: isFile ? "file" : "youtube",
        controls: true,
        autoplay: false,
      };
      const vidSec = createSection(1);
      vidSec.layout = "full";
      vidSec.contentWidth = 960;
      vidSec.styles = {
        ...vidSec.styles,
        padding: { desktop: { top: 20, right: 24, bottom: 20, left: 24, unit: "px" } },
        background: "#0f172a",
      };
      vidSec.columns[0].widgets = [video];
      sections.push(vidSec);
    };
    // Combo VSL+TSL / VSL: vídeo primeiro (abre) + espelho da sales page (TSL) abaixo.
    if (vslFocus) {
      pushVideoFold();
      pushMirrorFold();
    } else {
      pushMirrorFold();
      pushVideoFold();
    }
    mirrorFoldMode = "faithful";
  } else if (productFold && hero) {
    const fold = createSection(2);
    fold.layout = "full";
    fold.contentWidth = 1200;
    fold.styles = {
      ...fold.styles,
      padding: { desktop: { top: 36, right: 24, bottom: 40, left: 24, unit: "px" } },
      background: "#ffffff",
    };
    fold.columns[0].widthPercent = { desktop: 58, tablet: 100, mobile: 100 };
    fold.columns[1].widthPercent = { desktop: 42, tablet: 100, mobile: 100 };
    fold.columns[0].widgets = [heroImageWidget(hero, alt, offerForCtas)];
    fold.columns[1].widgets = copyWidgets;
    sections.push(fold);
    if (extraPhotos.length) {
      const gallery = createSection(1);
      gallery.styles = {
        ...gallery.styles,
        padding: { desktop: { top: 8, right: 24, bottom: 32, left: 24, unit: "px" } },
        background: "#ffffff",
      };
      gallery.columns[0].widgets = extraPhotos;
      sections.push(gallery);
    }
  } else {
    // Black portal OU white sem espelho/fotos: artigo editorial profissional (nunca stack genérico).
    pushEditorialArticleSections({
      sections,
      content,
      title,
      sourceTitle: asString(source.title) || title,
      language: source.language,
      cta,
      offer,
      offerForCtas,
      cookieType,
      hero,
      restImages,
      videoUrl,
      mode: white ? "white" : "black",
      presellType: source.type || "",
    });
  }

  /**
   * CTA extra só quando white cookies NÃO tem espelho (o espelho já traz os botões da oferta).
   * Evita um segundo «Allow» por baixo da review que compete com o modal e parte o layout.
   */
  if (cookie && white && offer && mirrorFold.length <= 80) {
    const lang = source.language || asString(content.language) || "pt-BR";
    const ctaLabel = cta || getPresellUiStrings(lang).midCta;
    const ctaSec = createSection(1);
    ctaSec.layout = "boxed";
    ctaSec.contentWidth = 720;
    ctaSec.styles = {
      ...ctaSec.styles,
      padding: { desktop: { top: 20, right: 24, bottom: 12, left: 24, unit: "px" } },
      margin: { desktop: { top: 8, right: 20, bottom: 0, left: 20, unit: "px" } },
      background: "#ffffff",
      border: { width: 1, style: "solid", color: "#e2e8f0", radius: 12 },
    };
    ctaSec.columns[0].widgets = [
      portalCtaNote(getPresellUiStrings(lang).midCta),
      portalOfferButton(ctaLabel, offer),
    ];
    sections.push(ctaSec);
  }

  if (cookie) {
    const gate = createSection(1);
    gate.styles = {
      ...gate.styles,
      padding: { desktop: { top: 12, right: 20, bottom: 28, left: 20, unit: "px" } },
      background: "transparent",
    };
    gate.columns[0].widgets = [cookie];
    sections.push(gate);
  }

  const sourcePageTitle =
    asString(content.sourcePageTitle) || asString(content.source_page_title) || title;
  const favicon =
    asString(content.faviconUrl) || asString(content.favicon_url) || hero || "";
  const description = asString(content.subtitle) || asString(content.metaDescription);

  return {
    id: id("page_"),
    name: title || asString(source.title) || "Presell",
    sections,
    settings: {
      background: mirrorFold.length > 80 || productFold || white ? "#ffffff" : "#f8fafc",
      maxContentWidth: mirrorFold.length > 80 || productFold ? 1200 : white ? 860 : 720,
      ...(mirrorFoldMode ? { htmlFoldMode: mirrorFoldMode } : {}),
    },
    seo: {
      title: sourcePageTitle,
      ...(description ? { description } : {}),
      ...(hero ? { ogImage: hero } : {}),
      ...(favicon ? { favicon } : {}),
    },
    updatedAt: Date.now(),
  };
}

/**
 * White / builder / edição manual publicada: reutiliza `pageDocument`.
 * Black sem edição manual: regenera o artigo limpo (layouts antigos desalinhados).
 */
export function resolvePresellPageDocument(
  stored: unknown,
  source: EditablePresellSource,
): PageDocument {
  const content = (source.content || {}) as Record<string, unknown>;
  const parsed = parsePresellBuilderPageDocument(stored);
  const preferStored =
    Boolean(parsed) &&
    (isWhiteNiche(content) ||
      source.type === "builder" ||
      content.manualVisualEdit === true ||
      content.manual_visual_edit === true);
  if (preferStored && parsed) return parsed;
  if (!isWhiteNiche(content)) {
    return buildEditablePageDocument(source);
  }
  return parsed ?? buildEditablePageDocument(source);
}

export type BakePublicOfferOptions = {
  /**
   * Presells tipo cookies sem «Ir directo à oferta»: modal só desbloqueia;
   * CTAs da página levam ao `/track/r/`.
   */
  unlockCookieOnly?: boolean;
  /**
   * Com `cookieRedirectToOffer`: Aceitar/Fechar do banner são links para `/track/r/`.
   * Tem prioridade sobre `unlockCookieOnly` no widget de cookies.
   */
  cookieRedirectToOffer?: boolean;
};

/** Na pública, o hoplink e o marcador do espelho passam a `/track/r/`. */
export function bakePublicOfferHrefs(
  doc: PageDocument,
  trackHref: string,
  affiliateHref = "",
  policyHref = "",
  options: BakePublicOfferOptions = {},
): PageDocument {
  const clone = JSON.parse(JSON.stringify(doc)) as PageDocument;
  const href = trackHref.trim() || affiliateHref.trim();
  const policy = policyHref.trim();
  const affiliate = affiliateHref.trim();
  const unlockCookieOnly = Boolean(options.unlockCookieOnly);
  const cookieRedirectToOffer = Boolean(options.cookieRedirectToOffer) && Boolean(href);
  const cookieGate = clone.sections.some((section) =>
    section.columns.some((column) => column.widgets.some((widget) => widget.type === "cookieBanner")),
  );
  for (const section of clone.sections) {
    for (const column of section.columns) {
      for (const widget of column.widgets) {
        if (widget.type === "html" && typeof widget.content.code === "string") {
          widget.content = {
            ...widget.content,
            code: href
              ? bakeHtmlOfferHrefs(widget.content.code, href, affiliate)
              : widget.content.code.split(CLICKORA_MIRROR_TRACK_MARKER).join(CLICKORA_MIRROR_TRACK_MARKER),
          };
        }
        if (href && widget.type === "image" && !cookieGate) {
          const link = asString(widget.content.link);
          if (!link || link === "#" || (affiliate && comparableUrl(link) === comparableUrl(affiliate))) {
            widget.content = { ...widget.content, link: href };
          }
        }
        if (cookieGate && widget.type === "image") {
          widget.content = { ...widget.content, link: "" };
        }
        if (widget.type === "cookieBanner") {
          const next: Record<string, unknown> = { ...widget.content };
          if (policy) next.policyUrl = policy;
          if (cookieRedirectToOffer) {
            next.offerHref = href;
          } else {
            // Aceitar/Fechar só fecham o aviso (compliance / unlock).
            delete next.offerHref;
          }
          widget.content = next;
        }
      }
    }
  }
  if (href) {
    pointOfferButtonsAt(clone, href, affiliate || undefined, {
      forceAllButtons: true,
      preserveCookieOfferHref: cookieRedirectToOffer,
    });
  }
  if (cookieGate && !unlockCookieOnly && !cookieRedirectToOffer) {
    for (const section of clone.sections) {
      for (const column of section.columns) {
        // Manter CTAs vindos do espelho (fromMirror); remover só botões sintéticos do portal.
        column.widgets = column.widgets.filter(
          (widget) => widget.type !== "button" || Boolean(widget.content.fromMirror),
        );
      }
    }
  }
  return clone;
}

function comparableUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** O botão principal segue o link da oferta da barra. Um botão único desatualizado também. */
export function pointOfferButtonsAt(
  doc: PageDocument,
  offerUrl: string,
  previousOffer?: string,
  options: { forceAllButtons?: boolean; preserveCookieOfferHref?: boolean } = {},
): PageDocument {
  const offer = offerUrl.trim();
  if (!offer) return doc;
  const previous = previousOffer ? comparableUrl(previousOffer) : "";
  const forceAllButtons = Boolean(options.forceAllButtons);
  const preserveCookieOfferHref = Boolean(options.preserveCookieOfferHref);
  const widgets = doc.sections.flatMap((section) => section.columns.flatMap((column) => column.widgets));
  const buttons = widgets.filter((widget) => widget.type === "button");
  for (const button of buttons) {
    const href = asString(button.content.href);
    const empty = !href || href === "#" || href.startsWith("#");
    const wasOffer = Boolean(previous) && comparableUrl(href) === previous;
    const onlyButton = buttons.length === 1;
    if (forceAllButtons || empty || wasOffer || onlyButton) {
      button.content = { ...button.content, href: offer };
    }
  }
  if (!preserveCookieOfferHref) {
    for (const cookie of widgets.filter((widget) => widget.type === "cookieBanner")) {
      if ("offerHref" in cookie.content) {
        const next = { ...cookie.content };
        delete next.offerHref;
        cookie.content = next;
      }
    }
  }
  return doc;
}

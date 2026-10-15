import { createSection, createWidget, id } from "@/page-builder/factory";
import type { PageDocument, WidgetNode } from "@/page-builder/types";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { CLICKORA_MIRROR_TRACK_MARKER } from "@/lib/presellMirrorMarkers";
import { getPresellGateKind } from "@/lib/presellTypeMeta";
import { resolveHealthArticle } from "@/lib/presellHealthArticle";
import { getPresellUiStrings } from "@/lib/presellUiStrings";

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
  return content.generationNiche === "white" || content.generation_niche === "white";
}

function heroImageWidget(src: string, alt: string, offer = "", isHero = true): WidgetNode {
  const image = createWidget("image");
  image.content = { ...image.content, src, alt, link: offer, ...(isHero ? { hero: true } : {}) };
  image.styles = {
    ...image.styles,
    width: { desktop: "100%" },
    align: { desktop: "center" },
    margin: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
  };
  return image;
}

/** Foto do produto em artigo black — sem banda hero de viewport inteira. */
function articleProductPhoto(src: string, alt: string, offer = ""): WidgetNode {
  const image = createWidget("image");
  image.content = { ...image.content, src, alt, link: offer, hero: false };
  image.styles = {
    ...image.styles,
    width: { desktop: "360px" },
    align: { desktop: "center" },
    margin: { desktop: { top: 0, right: 0, bottom: 8, left: 0, unit: "px" } },
  };
  return image;
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
  productNote: string;
}): string {
  const pillars = article.pillars
    .map(
      (p) =>
        `<div style="margin:0 0 1.35rem 0">` +
        `<p style="margin:0 0 0.4rem 0;font-weight:700;color:#0f172a;font-size:1.05rem;line-height:1.4">${escapeHtml(p.title)}</p>` +
        `<p style="margin:0;color:#475569;font-size:1rem;line-height:1.7">${escapeHtml(p.body)}</p>` +
        `</div>`,
    )
    .join("");
  return (
    `<p style="margin:0 0 1.5rem 0;color:#334155;font-size:1.05rem;line-height:1.75">${escapeHtml(article.intro)}</p>` +
    `<h2 style="margin:0 0 1rem 0;font-size:1.15rem;font-weight:700;color:#0f172a;line-height:1.35">${escapeHtml(article.pillarsTitle)}</h2>` +
    pillars +
    `<aside style="margin:1.75rem 0 0 0;padding:1rem 1.15rem;background:#f8fafc;border-left:3px solid #94a3b8;color:#475569;font-size:0.98rem;line-height:1.7">${escapeHtml(article.productNote)}</aside>`
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

function policyHrefFromContent(content: Record<string, unknown>): string {
  const urls = content.policyUrls;
  if (urls && typeof urls === "object") {
    const row = urls as Record<string, unknown>;
    const privacy = asString(row.privacy || row.cookie || row.cookies);
    if (privacy) return privacy;
  }
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

function offerCookie(offer: string, policyHref: string, language?: string | null): WidgetNode {
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
    overlayOpacity: 28,
    overlayBlur: 2,
    ...(offer ? { offerHref: offer } : {}),
    policyUrl: policyHref || "/privacidade",
  };
  return cookie;
}

/**
 * White: dobra fiel ao produto (espelho ou foto+texto).
 * Black: artigo informativo — sem clonar claims da oferta; hoplink só no gate de cookies.
 */
export function buildEditablePageDocument(source: EditablePresellSource): PageDocument {
  const content = source.content || {};
  const title = asString(content.title) || asString(content.productName) || asString(source.title);
  const html = textHtml(asString(content.subtitle), asString(content.salesText));
  const cta = asString(content.ctaText);
  const offer = asString(content.affiliateLink);
  const images = imageUrls(content.productImages);
  const alt = asString(content.productName) || title || "Produto";
  const [hero, ...restImages] = images;
  const videoUrl = asString(source.videoUrl);
  const white = isWhiteNiche(content);
  const cookieType = getPresellGateKind(source.type || "") === "cookies";
  const productFold = white && Boolean(hero);
  const copyWidgets: WidgetNode[] = [];

  if (title) copyWidgets.push(foldHeading(title, productFold ? "left" : "center"));
  if (html) copyWidgets.push(foldCopy(html));
  if (videoUrl) {
    const video = createWidget("video");
    video.content = { ...video.content, url: videoUrl, provider: "youtube", controls: true, autoplay: false };
    copyWidgets.push(video);
  }
  if (cta && offer && !cookieType) {
    const button = createWidget("button");
    button.content = { ...button.content, text: cta, href: offer, target: "_self" };
    copyWidgets.push(button);
  }

  const extraPhotos = restImages.map((src) => heroImageWidget(src, alt, cookieType ? "" : offer, false));
  // White cookies: Aceitar → oferta. Black: Aceitar só desbloqueia o artigo; CTA vai à oferta.
  const cookie = cookieType
    ? offerCookie(white ? offer : "", policyHrefFromContent(content), source.language)
    : null;

  const sections: ReturnType<typeof createSection>[] = [];
  const mirrorFold = white
    ? mirrorSrcDocToEditableHtml(
        asString(content.importMirrorSrcDoc) || asString(content.import_mirror_src_doc),
      )
    : "";

  if (mirrorFold.length > 80) {
    const htmlW = createWidget("html");
    htmlW.content = { ...htmlW.content, code: mirrorFold };
    const fold = createSection(1);
    fold.layout = "full";
    fold.contentWidth = 1200;
    fold.styles = {
      ...fold.styles,
      padding: { desktop: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" } },
      background: "#ffffff",
    };
    fold.columns[0].widgets = [htmlW];
    sections.push(fold);
    if (videoUrl) {
      const video = createWidget("video");
      video.content = { ...video.content, url: videoUrl, provider: "youtube", controls: true, autoplay: false };
      const vidSec = createSection(1);
      vidSec.columns[0].widgets = [video];
      sections.push(vidSec);
    }
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
    fold.columns[0].widgets = [heroImageWidget(hero, alt, cookieType ? "" : offer)];
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
  } else if (!white) {
    const article = resolveHealthArticle({
      content,
      productName: alt,
      language: source.language || asString(content.language) || "pt-BR",
      salesText: asString(content.salesText),
      ctaText: cta,
    });
    const offerLink = cookieType ? "" : offer;

    if (hero) {
      const media = createSection(1);
      media.layout = "full";
      media.contentWidth = 720;
      media.styles = {
        ...media.styles,
        padding: { desktop: { top: 36, right: 24, bottom: 8, left: 24, unit: "px" } },
        background: "#ffffff",
      };
      media.columns[0].widgets = [articleProductPhoto(hero, alt, offerLink)];
      sections.push(media);
    }

    if (videoUrl) {
      const video = createWidget("video");
      video.content = { ...video.content, url: videoUrl, provider: "youtube", controls: true, autoplay: false };
      const vidSec = createSection(1);
      vidSec.contentWidth = 720;
      vidSec.styles = {
        ...vidSec.styles,
        padding: { desktop: { top: 8, right: 24, bottom: 8, left: 24, unit: "px" } },
        background: "#ffffff",
      };
      vidSec.columns[0].widgets = [video];
      sections.push(vidSec);
    }

    const bodyWidgets: WidgetNode[] = [
      articleKicker(article.kicker),
      articleTitle(article.headline),
      articleCopy(articleBodyHtml(article)),
    ];
    if (offer) {
      const button = createWidget("button");
      button.content = {
        ...button.content,
        text: article.ctaLabel || cta || "Continuar",
        href: offer,
        target: "_self",
      };
      button.styles.margin = {
        desktop: { top: 20, right: 0, bottom: 0, left: 0, unit: "px" },
      };
      bodyWidgets.push(button);
    }

    const articleSec = createSection(1);
    articleSec.layout = "full";
    articleSec.contentWidth = 720;
    articleSec.styles = {
      ...articleSec.styles,
      padding: { desktop: { top: 12, right: 28, bottom: 40, left: 28, unit: "px" } },
      background: "#ffffff",
    };
    articleSec.columns[0].widgets = bodyWidgets;
    sections.push(articleSec);

    if (restImages.length) {
      const galleryWidgets = restImages
        .slice(0, 2)
        .map((src) => articleProductPhoto(src, alt, offerLink));
      const gallery = createSection(1);
      gallery.contentWidth = 720;
      gallery.styles = {
        ...gallery.styles,
        padding: { desktop: { top: 0, right: 28, bottom: 36, left: 28, unit: "px" } },
        background: "#ffffff",
      };
      gallery.columns[0].widgets = galleryWidgets;
      sections.push(gallery);
    }
  } else {
    const stacked: WidgetNode[] = [];
    if (hero) stacked.push(heroImageWidget(hero, alt, cookieType ? "" : offer));
    stacked.push(...copyWidgets, ...extraPhotos);
    const section = createSection(1);
    section.styles = {
      ...section.styles,
      padding: { desktop: { top: 28, right: 20, bottom: 48, left: 20, unit: "px" } },
      background: "#ffffff",
    };
    section.columns[0].widgets = stacked;
    if (stacked.length) sections.push(section);
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

  return {
    id: id("page_"),
    name: title || asString(source.title) || "Presell",
    sections,
    settings: {
      background: "#ffffff",
      maxContentWidth: mirrorFold.length > 80 || productFold ? 1200 : white ? 860 : 720,
    },
    updatedAt: Date.now(),
  };
}

/**
 * White: reutiliza o documento guardado (espelho/edição).
 * Black: regenera o artigo limpo — layouts antigos com hero viewport ficavam desalinhados.
 */
export function resolvePresellPageDocument(
  stored: unknown,
  source: EditablePresellSource,
): PageDocument {
  if (!isWhiteNiche(source.content || {})) {
    return buildEditablePageDocument(source);
  }
  return parsePresellBuilderPageDocument(stored) ?? buildEditablePageDocument(source);
}

export type BakePublicOfferOptions = {
  /**
   * Black Ads: cookie só desbloqueia o portal informativo.
   * White: cookie pode levar à oferta e remove botões duplicados.
   */
  unlockCookieOnly?: boolean;
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
  const cookieGate = clone.sections.some((section) =>
    section.columns.some((column) => column.widgets.some((widget) => widget.type === "cookieBanner")),
  );
  for (const section of clone.sections) {
    for (const column of section.columns) {
      for (const widget of column.widgets) {
        if (widget.type === "html" && typeof widget.content.code === "string") {
          widget.content = {
            ...widget.content,
            code: widget.content.code.split(CLICKORA_MIRROR_TRACK_MARKER).join(href || CLICKORA_MIRROR_TRACK_MARKER),
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
          if (unlockCookieOnly) next.offerHref = "";
          widget.content = next;
        }
      }
    }
  }
  if (href) {
    pointOfferButtonsAt(clone, href, affiliate || undefined, { assignCookieOffer: !unlockCookieOnly });
  }
  if (cookieGate && !unlockCookieOnly) {
    for (const section of clone.sections) {
      for (const column of section.columns) {
        column.widgets = column.widgets.filter((widget) => widget.type !== "button");
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
  options: { assignCookieOffer?: boolean } = {},
): PageDocument {
  const offer = offerUrl.trim();
  if (!offer) return doc;
  const previous = previousOffer ? comparableUrl(previousOffer) : "";
  const assignCookieOffer = options.assignCookieOffer !== false;
  const widgets = doc.sections.flatMap((section) => section.columns.flatMap((column) => column.widgets));
  const buttons = widgets.filter((widget) => widget.type === "button");
  for (const button of buttons) {
    const href = asString(button.content.href);
    const empty = !href || href === "#" || href.startsWith("#");
    const wasOffer = Boolean(previous) && comparableUrl(href) === previous;
    const onlyButton = buttons.length === 1;
    if (empty || wasOffer || onlyButton) {
      button.content = { ...button.content, href: offer };
    }
  }
  if (assignCookieOffer) {
    for (const cookie of widgets.filter((widget) => widget.type === "cookieBanner")) {
      const href = asString(cookie.content.offerHref);
      const empty = !href || href === "#" || href.startsWith("#");
      const wasOffer = Boolean(previous) && comparableUrl(href) === previous;
      if (empty || wasOffer) {
        cookie.content = { ...cookie.content, offerHref: offer };
      }
    }
  } else {
    for (const cookie of widgets.filter((widget) => widget.type === "cookieBanner")) {
      cookie.content = { ...cookie.content, offerHref: "" };
    }
  }
  return doc;
}

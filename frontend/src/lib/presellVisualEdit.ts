import { createSection, createWidget, id } from "@/page-builder/factory";
import type { PageDocument, WidgetNode } from "@/page-builder/types";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { CLICKORA_MIRROR_TRACK_MARKER } from "@/lib/presellMirrorMarkers";
import { getPresellGateKind } from "@/lib/presellTypeMeta";

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

function sanitizeImportedHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, "");
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

/** Estilos + corpo do espelho — a dobra original, editável no HTML widget. */
export function mirrorSrcDocToEditableHtml(srcdoc: string): string {
  const raw = srcdoc.trim();
  if (!raw) return "";
  const styles = [...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  let body = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? raw;
  const css = sanitizeImportedHtml(styles).trim();
  body = sanitizeImportedHtml(body);
  return `${css ? `<style>${css}</style>` : ""}${body}`.trim();
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

function offerCookie(offer: string, policyHref: string): WidgetNode {
  const cookie = createWidget("cookieBanner");
  cookie.content = {
    ...cookie.content,
    ...(offer ? { offerHref: offer } : {}),
    policyUrl: policyHref || "/privacidade",
  };
  return cookie;
}

/**
 * Documento do editor a partir do que a presell já tem.
 * Black: primeira dobra com foto grande + título grande (como a origem). Tudo editável.
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
  const blackFold = !isWhiteNiche(content) && Boolean(hero);
  const copyWidgets: WidgetNode[] = [];

  if (title) copyWidgets.push(foldHeading(title, blackFold ? "left" : "center"));
  if (html) copyWidgets.push(foldCopy(html));
  if (videoUrl) {
    const video = createWidget("video");
    video.content = { ...video.content, url: videoUrl, provider: "youtube", controls: true, autoplay: false };
    copyWidgets.push(video);
  }
  if (cta && offer) {
    const button = createWidget("button");
    button.content = { ...button.content, text: cta, href: offer, target: "_self" };
    copyWidgets.push(button);
  }

  const extraPhotos = restImages.map((src) => heroImageWidget(src, alt, offer, false));
  const cookie =
    getPresellGateKind(source.type || "") === "cookies"
      ? offerCookie(isWhiteNiche(content) ? "" : offer, policyHrefFromContent(content))
      : null;

  const sections: ReturnType<typeof createSection>[] = [];
  const mirrorFold = mirrorSrcDocToEditableHtml(
    asString(content.importMirrorSrcDoc) || asString(content.import_mirror_src_doc),
  );

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
  } else if (blackFold && hero) {
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
    fold.columns[0].widgets = [heroImageWidget(hero, alt, offer)];
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
    const stacked: WidgetNode[] = [];
    if (hero) stacked.push(heroImageWidget(hero, alt, offer));
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
      maxContentWidth: mirrorFold.length > 80 ? 1200 : blackFold ? 1140 : 860,
    },
    updatedAt: Date.now(),
  };
}

/** Documento guardado no conteúdo, senão o mesmo documento que o editor reconstrói. */
export function resolvePresellPageDocument(
  stored: unknown,
  source: EditablePresellSource,
): PageDocument {
  return parsePresellBuilderPageDocument(stored) ?? buildEditablePageDocument(source);
}

/** Na pública, o hoplink e o marcador do espelho passam a `/track/r/`. */
export function bakePublicOfferHrefs(
  doc: PageDocument,
  trackHref: string,
  affiliateHref = "",
  policyHref = "",
): PageDocument {
  const clone = JSON.parse(JSON.stringify(doc)) as PageDocument;
  const href = trackHref.trim() || affiliateHref.trim();
  const policy = policyHref.trim();
  const affiliate = affiliateHref.trim();
  for (const section of clone.sections) {
    for (const column of section.columns) {
      for (const widget of column.widgets) {
        if (widget.type === "html" && typeof widget.content.code === "string") {
          widget.content = {
            ...widget.content,
            code: widget.content.code.split(CLICKORA_MIRROR_TRACK_MARKER).join(href || CLICKORA_MIRROR_TRACK_MARKER),
          };
        }
        if (href && widget.type === "image") {
          const link = asString(widget.content.link);
          if (!link || link === "#" || (affiliate && comparableUrl(link) === comparableUrl(affiliate))) {
            widget.content = { ...widget.content, link: href };
          }
        }
        if (policy && widget.type === "cookieBanner") {
          widget.content = { ...widget.content, policyUrl: policy };
        }
      }
    }
  }
  if (href) pointOfferButtonsAt(clone, href, affiliate || undefined);
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
export function pointOfferButtonsAt(doc: PageDocument, offerUrl: string, previousOffer?: string): PageDocument {
  const offer = offerUrl.trim();
  if (!offer) return doc;
  const previous = previousOffer ? comparableUrl(previousOffer) : "";
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
  for (const cookie of widgets.filter((widget) => widget.type === "cookieBanner")) {
    const href = asString(cookie.content.offerHref);
    const empty = !href || href === "#" || href.startsWith("#");
    const wasOffer = Boolean(previous) && comparableUrl(href) === previous;
    if (empty || wasOffer) {
      cookie.content = { ...cookie.content, offerHref: offer };
    }
  }
  return doc;
}

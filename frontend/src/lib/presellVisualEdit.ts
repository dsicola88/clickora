import { createSection, createWidget, id } from "@/page-builder/factory";
import type { PageDocument, WidgetNode } from "@/page-builder/types";
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
    if (!/^https?:\/\//i.test(url) || !isUsefulPhoto(url)) continue;
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

/**
 * Documento do editor a partir do que a presell já tem.
 * Não inventa fotos, títulos nem botões. O link da oferta fica no botão quando existe texto de CTA.
 */
export function buildEditablePageDocument(source: EditablePresellSource): PageDocument {
  const content = source.content || {};
  const title = asString(content.title) || asString(content.productName) || asString(source.title);
  const html = textHtml(asString(content.subtitle), asString(content.salesText));
  const cta = asString(content.ctaText);
  const offer = asString(content.affiliateLink);
  const images = imageUrls(content.productImages);
  const alt = asString(content.productName) || title || "Produto";
  const widgets: WidgetNode[] = [];
  const [hero, ...restImages] = images;

  if (hero) {
    const image = createWidget("image");
    image.content = { ...image.content, src: hero, alt, link: "" };
    widgets.push(image);
  }

  if (title) {
    const heading = createWidget("heading");
    heading.content = { ...heading.content, text: title, tag: "h1" };
    const typo = heading.styles.typography;
    if (typo?.desktop) {
      heading.styles.typography = {
        ...typo,
        desktop: { ...typo.desktop, textAlign: "center", fontSize: 40, fontWeight: 700 },
      };
    }
    widgets.push(heading);
  }

  if (html) {
    const text = createWidget("text");
    text.content = { ...text.content, html };
    const typo = text.styles.typography;
    if (typo?.desktop) {
      text.styles.typography = {
        ...typo,
        desktop: { ...typo.desktop, textAlign: "left", fontSize: 18, lineHeight: 1.7 },
      };
    }
    widgets.push(text);
  }

  const videoUrl = asString(source.videoUrl);
  if (videoUrl) {
    const video = createWidget("video");
    video.content = { ...video.content, url: videoUrl, provider: "youtube", controls: true, autoplay: false };
    widgets.push(video);
  }

  if (cta && offer) {
    const button = createWidget("button");
    button.content = { ...button.content, text: cta, href: offer, target: "_self" };
    widgets.push(button);
  }

  for (const src of restImages) {
    const image = createWidget("image");
    image.content = { ...image.content, src, alt, link: "" };
    widgets.push(image);
  }

  if (getPresellGateKind(source.type || "") === "cookies") {
    widgets.push(createWidget("cookieBanner"));
  }

  const section = createSection(1);
  section.styles = {
    ...section.styles,
    padding: { desktop: { top: 28, right: 20, bottom: 48, left: 20, unit: "px" } },
    background: "#ffffff",
  };
  section.columns[0].widgets = widgets;

  return {
    id: id("page_"),
    name: title || asString(source.title) || "Presell",
    sections: widgets.length ? [section] : [],
    settings: { background: "#ffffff", maxContentWidth: 860 },
    updatedAt: Date.now(),
  };
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
  const buttons = doc.sections.flatMap((section) => section.columns.flatMap((column) => column.widgets)).filter((widget) => widget.type === "button");
  for (const button of buttons) {
    const href = asString(button.content.href);
    const empty = !href || href === "#" || href.startsWith("#");
    const wasOffer = Boolean(previous) && comparableUrl(href) === previous;
    const onlyButton = buttons.length === 1;
    if (empty || wasOffer || onlyButton) {
      button.content = { ...button.content, href: offer };
    }
  }
  return doc;
}

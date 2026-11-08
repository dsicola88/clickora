/**
 * Converte HTML do espelho (white import) em widgets nativos do builder
 * para edição visual (título, texto, imagem, botão, cores, links).
 */
import { createSection, createWidget } from "@/page-builder/factory";
import type { PageDocument, SectionNode, WidgetNode } from "@/page-builder/types";

const NATIVE_TYPES = new Set(["heading", "text", "image", "button", "video", "divider"]);

const FLATTEN_TAGS = new Set([
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "nav",
  "aside",
  "figure",
  "figcaption",
  "li",
  "span",
  "table",
  "tbody",
  "thead",
  "tfoot",
  "tr",
  "td",
  "th",
  "form",
  "fieldset",
  "label",
  "center",
  "font",
  "summary",
  "details",
  "template",
]);

const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "meta",
  "link",
  "base",
  "head",
  "title",
  "object",
  "embed",
  "canvas",
]);

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function textContent(el: Element): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

function styleProp(el: Element, prop: string): string {
  const style = el.getAttribute("style") || "";
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i");
  const m = style.match(re);
  return (m?.[1] || "").trim();
}

function parseFontSizePx(el: Element): number {
  const raw = styleProp(el, "font-size");
  if (!raw) return 0;
  const px = raw.match(/^([\d.]+)\s*px$/i);
  if (px) return Number(px[1]) || 0;
  const em = raw.match(/^([\d.]+)\s*em$/i);
  if (em) return (Number(em[1]) || 0) * 16;
  const rem = raw.match(/^([\d.]+)\s*rem$/i);
  if (rem) return (Number(rem[1]) || 0) * 16;
  return 0;
}

function applyColor(widget: WidgetNode, el: Element) {
  const color = styleProp(el, "color");
  if (color) widget.styles = { ...widget.styles, color };
  const bg = styleProp(el, "background-color") || styleProp(el, "background");
  if (bg && !/^url\(/i.test(bg)) widget.styles = { ...widget.styles, background: bg };
}

function looksLikeCta(el: Element): boolean {
  const cls = `${el.getAttribute("class") || ""} ${el.getAttribute("id") || ""}`.toLowerCase();
  if (/btn|button|cta|order|buy|checkout|add-to-cart|shop|purchase/.test(cls)) return true;
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (role === "button") return true;
  const t = textContent(el);
  if (t.length > 0 && t.length <= 48 && /order|buy|shop|get|claim|add|comprar|pedir|quero|agora|now|checkout/i.test(t)) {
    return true;
  }
  return false;
}

function looksLikeHeadline(el: Element): boolean {
  const cls = `${el.getAttribute("class") || ""} ${el.getAttribute("id") || ""}`.toLowerCase();
  if (/headline|hero[-_]?title|banner[-_]?title|main[-_]?title|page[-_]?title|display|h1\b/.test(cls)) {
    return true;
  }
  const size = parseFontSizePx(el);
  const weight = styleProp(el, "font-weight");
  const bold = /^(bold|[6-9]00)$/i.test(weight);
  const t = textContent(el);
  if (size >= 28 && t.length >= 4 && t.length <= 120 && !el.querySelector("p,div,section,ul,ol,img,a,button")) {
    return true;
  }
  if (bold && size >= 22 && t.length >= 4 && t.length <= 90 && !el.children.length) return true;
  return false;
}

function absUrl(raw: string, baseHref: string): string {
  const href = raw.trim();
  if (!href) return "";
  if (/^(https?:|data:|mailto:|tel:|#|\/api\/)/i.test(href)) return href;
  try {
    return new URL(href, baseHref || undefined).href;
  } catch {
    return href;
  }
}

function headingWidget(el: Element, forcedTag?: "h1" | "h2" | "h3"): WidgetNode {
  const tag =
    forcedTag ||
    (/^h[1-6]$/i.test(el.tagName) ? (el.tagName.toLowerCase() as "h1" | "h2" | "h3" | "h4" | "h5" | "h6") : "h2");
  const w = createWidget("heading");
  w.content = { ...w.content, text: textContent(el) || "Título", tag };
  applyColor(w, el);
  const align = styleProp(el, "text-align");
  if (align === "center" || align === "left" || align === "right") {
    const typo = w.styles.typography;
    if (typo?.desktop) {
      w.styles.typography = {
        ...typo,
        desktop: { ...typo.desktop, textAlign: align },
      };
    }
  }
  const size = parseFontSizePx(el);
  if (size >= 18) {
    const typo = w.styles.typography;
    if (typo?.desktop) {
      w.styles.typography = {
        ...typo,
        desktop: { ...typo.desktop, fontSize: Math.min(72, Math.round(size)) },
      };
    }
  }
  return w;
}

function textWidgetFromHtml(html: string, el?: Element): WidgetNode {
  const w = createWidget("text");
  w.content = { ...w.content, html };
  if (el) applyColor(w, el);
  return w;
}

function imageWidget(el: Element, baseHref: string): WidgetNode | null {
  const src = absUrl(el.getAttribute("src") || el.getAttribute("data-src") || "", baseHref);
  if (!src) return null;
  if (src.startsWith("data:image/svg")) return null;
  if (src.startsWith("data:") && !src.startsWith("data:image/")) return null;
  const w = createWidget("image");
  const parent = el.parentElement;
  let link = "";
  if (parent && parent.tagName.toLowerCase() === "a") {
    link = absUrl(parent.getAttribute("href") || "", baseHref);
  }
  w.content = {
    ...w.content,
    src,
    alt: el.getAttribute("alt") || "Imagem",
    link: link && link !== "#" ? link : "",
  };
  applyColor(w, el);
  return w;
}

function buttonWidget(el: Element, baseHref: string): WidgetNode {
  const w = createWidget("button");
  const href =
    absUrl(el.getAttribute("href") || "", baseHref) ||
    absUrl(el.getAttribute("data-href") || "", baseHref) ||
    absUrl(el.getAttribute("data-url") || "", baseHref) ||
    "#";
  const text = textContent(el) || "Botão";
  w.content = {
    ...w.content,
    text: text.slice(0, 120),
    href: href || "#",
    target: "_self",
    fromMirror: true,
  };
  applyColor(w, el);
  const bg = styleProp(el, "background-color") || styleProp(el, "background");
  if (bg && !/^url\(/i.test(bg)) w.styles = { ...w.styles, background: bg };
  const color = styleProp(el, "color");
  if (color) w.styles = { ...w.styles, color };
  return w;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlIsland(el: Element): WidgetNode[] {
  const html = (el as HTMLElement).outerHTML || "";
  if (html.length < 40) return [];
  if (textContent(el).length + el.querySelectorAll("img").length === 0) return [];
  const w = createWidget("html");
  w.content = { ...w.content, code: html.slice(0, 80_000), fromMirror: true };
  return [w];
}

function flattenChildren(el: Element, baseHref: string, depth: number): WidgetNode[] {
  const out: WidgetNode[] = [];
  for (const child of Array.from(el.children)) {
    out.push(...elementToWidgets(child, baseHref, depth + 1));
  }
  if (!el.children.length) {
    const t = textContent(el);
    if (t.length >= 2) out.push(textWidgetFromHtml(`<p>${escapeHtml(t)}</p>`, el));
  }
  return out;
}

function elementToWidgets(el: Element, baseHref: string, depth: number): WidgetNode[] {
  if (depth > 24) {
    return htmlIsland(el);
  }

  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return [];

  if (/^h[1-6]$/.test(tag)) {
    if (!textContent(el)) return [];
    return [headingWidget(el)];
  }

  if (tag === "p") {
    const inner = (el as HTMLElement).innerHTML?.trim() || "";
    if (!textContent(el) && !/<img\b/i.test(inner)) return [];
    if (/<img\b/i.test(inner)) {
      return flattenChildren(el, baseHref, depth);
    }
    return [textWidgetFromHtml(`<p>${inner}</p>`, el)];
  }

  if (tag === "img") {
    const img = imageWidget(el, baseHref);
    return img ? [img] : [];
  }

  if (tag === "picture") {
    const img = el.querySelector("img");
    if (img) {
      const w = imageWidget(img, baseHref);
      return w ? [w] : [];
    }
    return [];
  }

  if (tag === "hr") {
    return [createWidget("divider")];
  }

  if (tag === "br") return [];

  if (tag === "a") {
    const img = el.querySelector(":scope > img, :scope > picture img");
    if (img && textContent(el).length < 2) {
      const w = imageWidget(img, baseHref);
      return w ? [w] : [];
    }
    const href = absUrl(el.getAttribute("href") || "", baseHref);
    const legalNav =
      /privacy|privacidade|terms|termos|cookie|contacto|contact|about|sobre|aviso|legal|imprint|policy/i.test(
        `${textContent(el)} ${href}`,
      );
    if (
      !legalNav &&
      (looksLikeCta(el) ||
        (!el.querySelector("div,section,p,h1,h2,h3,table,ul,ol") && textContent(el).length <= 64))
    ) {
      return [buttonWidget(el, baseHref)];
    }
    // Links com bloco interior → desdobrar filhos (imagem + texto)
    if (el.querySelector("div,section,p,h1,h2,h3,img,table")) {
      const kids = flattenChildren(el, baseHref, depth);
      if (kids.length) return kids;
    }
    const inner = (el as HTMLElement).innerHTML?.trim() || textContent(el);
    if (!inner) return [];
    return [textWidgetFromHtml(`<p>${(el as HTMLElement).outerHTML}</p>`, el)];
  }

  if (tag === "button") {
    if (!textContent(el)) return [];
    return [buttonWidget(el, baseHref)];
  }

  if (tag === "ul" || tag === "ol") {
    const html = (el as HTMLElement).outerHTML;
    if (textContent(el).length < 2) return [];
    return [textWidgetFromHtml(html, el)];
  }

  if (tag === "blockquote") {
    const inner = (el as HTMLElement).innerHTML?.trim() || textContent(el);
    if (!inner) return [];
    return [textWidgetFromHtml(`<blockquote>${inner}</blockquote>`, el)];
  }

  // CTA estilizado em div/span sem <a>/<button>
  if (
    (tag === "div" || tag === "span") &&
    looksLikeCta(el) &&
    !el.querySelector("a,button,input,img,p,h1,h2,h3,h4,ul,ol,table") &&
    textContent(el).length > 0 &&
    textContent(el).length <= 64
  ) {
    return [buttonWidget(el, baseHref)];
  }

  // Headline em div/span (landers sem <h1>)
  if (
    (tag === "div" || tag === "span") &&
    looksLikeHeadline(el) &&
    textContent(el).length >= 4
  ) {
    return [headingWidget(el, parseFontSizePx(el) >= 40 ? "h1" : "h2")];
  }

  if (FLATTEN_TAGS.has(tag)) {
    const kids = flattenChildren(el, baseHref, depth);
    if (kids.length) return kids;
    const t = textContent(el);
    if (t.length >= 2) {
      if (looksLikeHeadline(el)) return [headingWidget(el, "h2")];
      return [textWidgetFromHtml(`<p>${escapeHtml(t)}</p>`, el)];
    }
    return [];
  }

  // Tags desconhecidas: tentar filhos antes de ilha HTML
  const kids = flattenChildren(el, baseHref, depth);
  if (kids.length >= 1) return kids;
  return htmlIsland(el);
}

function extractBaseHref(html: string): string {
  const m = html.match(/<base\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')/i);
  return (m?.[2] ?? m?.[3] ?? "").trim();
}

function extractBodyHtml(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1];
  if (body != null) return body;
  return html
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function extractSectionBackground(el: Element): string | undefined {
  const bg = styleProp(el, "background-color") || styleProp(el, "background");
  if (bg && !/^url\(/i.test(bg) && bg.length < 80) return bg;
  return undefined;
}

function countNatives(widgets: WidgetNode[]): number {
  return widgets.filter((w) => NATIVE_TYPES.has(w.type)).length;
}

/**
 * Passagem semântica em ordem de documento — cobre landers com markup atípico
 * (tabelas, divs sem h1, CTAs estilizados) quando o flatten recursivo falha.
 */
function harvestSemanticWidgets(root: Element, baseHref: string): WidgetNode[] {
  const widgets: WidgetNode[] = [];
  const consumed = new Set<Element>();

  const markTree = (el: Element) => {
    consumed.add(el);
    el.querySelectorAll("*").forEach((n) => consumed.add(n));
  };

  const isConsumed = (el: Element) => consumed.has(el);

  const candidates = Array.from(
    root.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,img,picture,hr,ul,ol,blockquote,a,button,[role='button'],[class*='btn'],[class*='cta'],[class*='headline'],[class*='hero-title']",
    ),
  );

  for (const el of candidates) {
    if (isConsumed(el)) continue;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      if (!textContent(el)) continue;
      widgets.push(headingWidget(el));
      markTree(el);
      continue;
    }

    if (tag === "p") {
      const inner = (el as HTMLElement).innerHTML?.trim() || "";
      if (!textContent(el) && !/<img\b/i.test(inner)) continue;
      if (/<img\b/i.test(inner)) {
        for (const img of Array.from(el.querySelectorAll("img"))) {
          if (isConsumed(img)) continue;
          const w = imageWidget(img, baseHref);
          if (w) {
            widgets.push(w);
            markTree(img);
          }
        }
        continue;
      }
      widgets.push(textWidgetFromHtml(`<p>${inner}</p>`, el));
      markTree(el);
      continue;
    }

    if (tag === "img") {
      const w = imageWidget(el, baseHref);
      if (w) {
        widgets.push(w);
        markTree(el);
      }
      continue;
    }

    if (tag === "picture") {
      const img = el.querySelector("img");
      if (img && !isConsumed(img)) {
        const w = imageWidget(img, baseHref);
        if (w) {
          widgets.push(w);
          markTree(el);
        }
      }
      continue;
    }

    if (tag === "hr") {
      widgets.push(createWidget("divider"));
      markTree(el);
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      if (textContent(el).length < 2) continue;
      widgets.push(textWidgetFromHtml((el as HTMLElement).outerHTML, el));
      markTree(el);
      continue;
    }

    if (tag === "blockquote") {
      const inner = (el as HTMLElement).innerHTML?.trim() || textContent(el);
      if (!inner) continue;
      widgets.push(textWidgetFromHtml(`<blockquote>${inner}</blockquote>`, el));
      markTree(el);
      continue;
    }

    if (tag === "a" || tag === "button" || el.getAttribute("role") === "button" || looksLikeCta(el)) {
      if (tag === "a") {
        const img = el.querySelector(":scope > img, :scope > picture img");
        if (img && textContent(el).length < 2) {
          const w = imageWidget(img, baseHref);
          if (w) {
            widgets.push(w);
            markTree(el);
          }
          continue;
        }
      }
      if (!textContent(el) && tag !== "a") continue;
      if (textContent(el).length > 80 && !looksLikeCta(el)) {
        // link de texto longo → texto com âncora
        widgets.push(textWidgetFromHtml(`<p>${(el as HTMLElement).outerHTML}</p>`, el));
        markTree(el);
        continue;
      }
      if (textContent(el)) {
        widgets.push(buttonWidget(el, baseHref));
        markTree(el);
      }
      continue;
    }

    if (looksLikeHeadline(el) && textContent(el).length >= 4) {
      widgets.push(headingWidget(el, parseFontSizePx(el) >= 40 ? "h1" : "h2"));
      markTree(el);
    }
  }

  return widgets;
}

function pickBestWidgets(recursive: WidgetNode[], harvested: WidgetNode[]): WidgetNode[] {
  const rN = countNatives(recursive);
  const hN = countNatives(harvested);
  const rHtml = recursive.filter((w) => w.type === "html").length;
  const hHtml = harvested.filter((w) => w.type === "html").length;

  if (hN > rN) return harvested;
  if (hN === rN && hN > 0 && hHtml < rHtml) return harvested;
  if (rN >= 2) return recursive;
  if (hN >= 1) return harvested;
  if (recursive.length) return recursive;
  return harvested;
}

function filterWidgets(widgets: WidgetNode[]): WidgetNode[] {
  return widgets.filter((w) => {
    if (w.type === "heading") return asString(w.content.text).length > 0;
    if (w.type === "text") return asString(w.content.html).replace(/<[^>]+>/g, "").trim().length > 0;
    if (w.type === "image") return asString(w.content.src).length > 0;
    if (w.type === "button") return asString(w.content.text).length > 0;
    if (w.type === "html") return asString(w.content.code).length > 40;
    return true;
  });
}

/** Decompõe HTML editável do espelho em widgets nativos. */
export function decomposeMirrorHtmlToWidgets(editableHtml: string): WidgetNode[] {
  const raw = editableHtml.trim();
  if (!raw || typeof DOMParser === "undefined") return [];

  const baseHref = extractBaseHref(raw);
  const bodyHtml = extractBodyHtml(raw);
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`,
    "text/html",
  );
  const body = doc.body;
  if (!body) return [];

  const recursive: WidgetNode[] = [];
  for (const child of Array.from(body.children)) {
    recursive.push(...elementToWidgets(child, baseHref, 0));
  }
  if (!recursive.length && textContent(body).length >= 2) {
    recursive.push(textWidgetFromHtml(`<p>${escapeHtml(textContent(body))}</p>`));
  }

  const harvested = harvestSemanticWidgets(body, baseHref);
  const picked = pickBestWidgets(filterWidgets(recursive), filterWidgets(harvested));
  return filterWidgets(picked);
}

export function isMonolithicHtmlFold(doc: PageDocument | null | undefined): boolean {
  if (!doc?.sections?.length) return false;
  const widgets = doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets));
  const htmlBig = widgets.filter((w) => w.type === "html" && asString(w.content.code).length > 80);
  if (!htmlBig.length) return false;
  const natives = widgets.filter((w) => NATIVE_TYPES.has(w.type));
  return htmlBig.length >= 1 && natives.length <= 2;
}

function isUsefulDecomposition(parts: WidgetNode[]): boolean {
  if (parts.length === 0) return false;
  const natives = countNatives(parts);
  if (natives >= 2) return true;
  if (natives >= 1 && parts.length >= 2) return true;
  // Um único nativo (ex.: só imagem) ainda é melhor que HTML opaco
  if (natives >= 1 && parts.every((w) => w.type !== "html")) return true;
  return false;
}

/**
 * Expande widgets `html` monolíticos do import em blocos editáveis (in-place clone).
 * Devolve o mesmo doc se não houver nada a expandir.
 */
export function expandMonolithicHtmlDocument(doc: PageDocument): PageDocument {
  if (!isMonolithicHtmlFold(doc)) return doc;
  const clone = JSON.parse(JSON.stringify(doc)) as PageDocument;
  let changed = false;

  for (const section of clone.sections) {
    for (const column of section.columns) {
      const next: WidgetNode[] = [];
      for (const widget of column.widgets) {
        const code = asString(widget.content.code);
        if (widget.type === "html" && code.length > 80) {
          const parts = decomposeMirrorHtmlToWidgets(code);
          if (isUsefulDecomposition(parts)) {
            next.push(...parts);
            changed = true;
            continue;
          }
        }
        next.push(widget);
      }
      column.widgets = next;
    }
  }

  if (!changed) return doc;

  // Se a dobra ficou numa só secção com muitos blocos top-level, tentar fatiar em secções
  const sliced = maybeSplitIntoSections(clone);
  sliced.updatedAt = Date.now();
  return sliced;
}

function maybeSplitIntoSections(doc: PageDocument): PageDocument {
  if (doc.sections.length !== 1) return doc;
  const widgets = doc.sections[0].columns[0]?.widgets || [];
  if (widgets.length < 6) return doc;

  // Heurística: cada grupo começa num heading (ou a cada ~8 widgets)
  const groups: WidgetNode[][] = [];
  let current: WidgetNode[] = [];
  for (const w of widgets) {
    if (w.type === "heading" && current.length >= 2) {
      groups.push(current);
      current = [w];
    } else {
      current.push(w);
      if (current.length >= 10 && w.type !== "heading") {
        groups.push(current);
        current = [];
      }
    }
  }
  if (current.length) groups.push(current);
  if (groups.length < 2) return doc;

  const sections = groups.map((group) => {
    const fold = createSection(1);
    fold.layout = "full";
    fold.contentWidth = 1200;
    fold.styles = {
      ...fold.styles,
      padding: { desktop: { top: 16, right: 16, bottom: 24, left: 16, unit: "px" } },
      background: "#ffffff",
    };
    fold.columns[0].widgets = group;
    return fold;
  });

  return { ...doc, sections };
}

function sectionFromWidgets(widgets: WidgetNode[], background?: string): SectionNode {
  const fold = createSection(1);
  fold.layout = "full";
  fold.contentWidth = 1200;
  fold.styles = {
    ...fold.styles,
    padding: { desktop: { top: 16, right: 16, bottom: 24, left: 16, unit: "px" } },
    background: background || "#ffffff",
  };
  fold.columns[0].widgets = widgets;
  return fold;
}

/**
 * Constrói uma ou mais secções a partir do HTML do espelho.
 * Preferido sobre um único widget HTML para o editor manual.
 */
export function sectionsFromMirrorHtml(editableHtml: string): SectionNode[] {
  const raw = editableHtml.trim();
  if (!raw || typeof DOMParser === "undefined") return [];

  const baseHref = extractBaseHref(raw);
  const bodyHtml = extractBodyHtml(raw);
  const parsed = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${bodyHtml}</body></html>`,
    "text/html",
  );
  const body = parsed.body;
  if (!body) return [];

  const topBlocks = Array.from(body.children).filter((el) => {
    const tag = el.tagName.toLowerCase();
    return !SKIP_TAGS.has(tag);
  });

  // Só fatiar em várias secções quando os blocos de topo são contentores substanciais
  // (header/section/div com vários filhos) — não um <h1> + <a> soltos.
  const substantialBlocks = topBlocks.filter((el) => {
    const tag = el.tagName.toLowerCase();
    if (["header", "footer", "section", "article", "main", "nav", "table"].includes(tag)) {
      return textContent(el).length > 20 || el.querySelectorAll("img,a,button,p,h1,h2,h3").length >= 2;
    }
    if (tag === "div" || tag === "td") {
      return (
        el.children.length >= 2 &&
        (textContent(el).length > 40 || el.querySelectorAll("img,a,button").length >= 1)
      );
    }
    return false;
  });

  if (substantialBlocks.length >= 2) {
    const sections: SectionNode[] = [];
    for (const block of substantialBlocks) {
      const widgets = filterWidgets(elementToWidgets(block, baseHref, 0));
      const harvested = filterWidgets(harvestSemanticWidgets(block, baseHref));
      const parts = pickBestWidgets(widgets, harvested);
      if (!parts.length) continue;
      if (!isUsefulDecomposition(parts) && !(parts.length === 1 && parts[0].type === "html")) continue;
      sections.push(sectionFromWidgets(parts, extractSectionBackground(block)));
    }
    const allNatives = sections
      .flatMap((s) => s.columns[0].widgets)
      .filter((w) => NATIVE_TYPES.has(w.type));
    if (sections.length >= 2 && allNatives.length >= 2) return sections;
  }

  const widgets = decomposeMirrorHtmlToWidgets(editableHtml);
  if (!isUsefulDecomposition(widgets)) return [];
  const doc = maybeSplitIntoSections({
    id: "tmp",
    name: "tmp",
    sections: [sectionFromWidgets(widgets)],
    settings: {},
    updatedAt: Date.now(),
  });
  return doc.sections;
}

/** Secção full-width com widgets do espelho (para buildEditablePageDocument). */
export function sectionFromMirrorHtml(editableHtml: string): SectionNode | null {
  const sections = sectionsFromMirrorHtml(editableHtml);
  if (!sections.length) return null;
  if (sections.length === 1) return sections[0];
  // Compat: API antiga devolve uma secção — o caller novo usa sectionsFromMirrorHtml
  const fold = createSection(1);
  fold.layout = "full";
  fold.contentWidth = 1200;
  fold.styles = {
    ...fold.styles,
    padding: { desktop: { top: 16, right: 16, bottom: 24, left: 16, unit: "px" } },
    background: "#ffffff",
  };
  fold.columns[0].widgets = sections.flatMap((s) => s.columns[0].widgets);
  return fold;
}

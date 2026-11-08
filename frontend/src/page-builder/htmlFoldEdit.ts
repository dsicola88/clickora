/**
 * Edição fiel do widget HTML (espelho): mantém CSS/layout original no shadow DOM
 * e expõe selecção + patches para o painel de propriedades.
 */
import { create } from "zustand";

export type HtmlFoldInnerKind = "heading" | "text" | "image" | "link" | "button" | "block";

export type HtmlFoldSelectionSnapshot = {
  widgetId: string;
  kind: HtmlFoldInnerKind;
  tagName: string;
  text: string;
  href: string;
  src: string;
  alt: string;
  color: string;
  background: string;
};

export type HtmlFoldPatch = {
  text?: string;
  href?: string;
  src?: string;
  alt?: string;
  color?: string;
  background?: string;
};

type HtmlFoldEditState = {
  selection: HtmlFoldSelectionSnapshot | null;
  /** Aplica patch no elemento seleccionado no shadow (definido pelo HtmlWidget activo). */
  applyPatch: ((patch: HtmlFoldPatch) => void) | null;
  setSelection: (sel: HtmlFoldSelectionSnapshot | null) => void;
  setApplyPatch: (fn: ((patch: HtmlFoldPatch) => void) | null) => void;
  clear: () => void;
};

export const useHtmlFoldEdit = create<HtmlFoldEditState>((set) => ({
  selection: null,
  applyPatch: null,
  setSelection: (selection) => set({ selection }),
  setApplyPatch: (applyPatch) => set({ applyPatch }),
  clear: () => set({ selection: null, applyPatch: null }),
}));

const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "BASE", "META", "NOSCRIPT", "SVG", "PATH"]);

export function classifyHtmlFoldElement(el: Element): HtmlFoldInnerKind | null {
  const tag = el.tagName.toUpperCase();
  if (SKIP.has(tag)) return null;
  if (/^H[1-6]$/.test(tag)) return "heading";
  if (tag === "IMG") return "image";
  if (tag === "PICTURE") return "image";
  if (tag === "A") {
    const cls = `${el.getAttribute("class") || ""} ${el.getAttribute("id") || ""}`.toLowerCase();
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    const href = (el.getAttribute("href") || "").toLowerCase();
    const looksBtnClass = /btn|button|cta|order|buy|checkout|purchase/.test(cls);
    const looksCtaText =
      text.length > 0 &&
      text.length <= 48 &&
      /order|buy|shop|get|claim|add|comprar|pedir|quero|agora|now|checkout/i.test(text);
    const softNav = /^(#|\/?(privacy|terms|benefits|support|faq|about|contacto|contact))/i.test(href);
    if ((looksBtnClass || looksCtaText) && !softNav) return "button";
    return "link";
  }
  if (tag === "BUTTON" || el.getAttribute("role") === "button") return "button";
  if (tag === "P" || tag === "LI" || tag === "SPAN" || tag === "LABEL") return "text";
  if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "HEADER" || tag === "FOOTER" || tag === "TD") {
    return "block";
  }
  return "block";
}

function readColor(el: Element, prop: "color" | "backgroundColor"): string {
  try {
    const cs = (el.ownerDocument.defaultView || window).getComputedStyle(el as HTMLElement);
    const v = prop === "color" ? cs.color : cs.backgroundColor;
    if (!v || v === "rgba(0, 0, 0, 0)" || v === "transparent") return "";
    return v;
  } catch {
    return "";
  }
}

export function snapshotHtmlFoldElement(widgetId: string, el: Element): HtmlFoldSelectionSnapshot | null {
  const kind = classifyHtmlFoldElement(el);
  if (!kind) return null;
  const tag = el.tagName.toLowerCase();
  let target = el;
  if (tag === "picture") {
    const img = el.querySelector("img");
    if (img) target = img;
  }
  const text = (target.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const href =
    target.getAttribute("href") ||
    target.getAttribute("data-href") ||
    (target.closest("a")?.getAttribute("href") ?? "") ||
    "";
  const src =
    target.getAttribute("src") ||
    (target.tagName === "IMG" ? "" : el.querySelector("img")?.getAttribute("src") || "") ||
    "";
  const alt = target.getAttribute("alt") || el.querySelector("img")?.getAttribute("alt") || "";
  return {
    widgetId,
    kind: kind === "image" && !src && tag === "picture" ? "image" : kind,
    tagName: target.tagName.toLowerCase(),
    text,
    href,
    src,
    alt,
    color: readColor(target, "color"),
    background: readColor(target, "backgroundColor"),
  };
}

const SELECTED_ATTR = "data-clickora-html-selected";
const EDITABLE_ATTR = "data-clickora-html-field";

export function clearHtmlFoldSelectionMarks(root: ParentNode) {
  root.querySelectorAll(`[${SELECTED_ATTR}]`).forEach((n) => n.removeAttribute(SELECTED_ATTR));
}

export function markHtmlFoldSelected(el: Element) {
  el.setAttribute(SELECTED_ATTR, "1");
}

/** Estilos de edição injectados só no shadow (não vão para o HTML persistido). */
export const HTML_FOLD_EDITOR_STYLE = `
[${SELECTED_ATTR}="1"] {
  outline: 2px solid #e11d48 !important;
  outline-offset: 2px;
  cursor: pointer;
}
[${EDITABLE_ATTR}="1"] {
  outline: 1px dashed rgba(225, 29, 72, 0.45);
  outline-offset: 1px;
  cursor: text;
}
[${EDITABLE_ATTR}="1"]:focus {
  outline: 2px solid #e11d48;
}
img[${SELECTED_ATTR}="1"],
picture[${SELECTED_ATTR}="1"] {
  outline: 2px solid #e11d48 !important;
  outline-offset: 2px;
}
`;

export function stripHtmlFoldEditorChrome(html: string): string {
  return html
    .replace(/\s*data-clickora-html-selected="[^"]*"/gi, "")
    .replace(/\s*data-clickora-html-field="[^"]*"/gi, "")
    .replace(/\s*contenteditable="[^"]*"/gi, "")
    .replace(/<style[^>]*data-clickora-html-editor[^>]*>[\s\S]*?<\/style>/gi, "");
}

export function ensureHtmlFoldEditorStyle(shadow: ShadowRoot) {
  if (shadow.querySelector('style[data-clickora-html-editor="1"]')) return;
  const style = document.createElement("style");
  style.setAttribute("data-clickora-html-editor", "1");
  style.textContent = HTML_FOLD_EDITOR_STYLE;
  shadow.insertBefore(style, shadow.firstChild);
}

export function applyHtmlFoldPatchToElement(el: Element, patch: HtmlFoldPatch): Element {
  let target = el;
  if (el.tagName === "PICTURE") {
    const img = el.querySelector("img");
    if (img) target = img;
  }
  const htmlEl = target as HTMLElement;

  if (patch.src != null && (target.tagName === "IMG" || el.querySelector("img"))) {
    const img = target.tagName === "IMG" ? target : el.querySelector("img");
    if (img) {
      img.setAttribute("src", patch.src);
      if (img.hasAttribute("srcset")) img.removeAttribute("srcset");
      if (img.hasAttribute("data-src")) img.setAttribute("data-src", patch.src);
    }
  }
  if (patch.alt != null) {
    const img = target.tagName === "IMG" ? target : el.querySelector("img");
    if (img) img.setAttribute("alt", patch.alt);
  }
  if (patch.href != null) {
    const anchor =
      target.tagName === "A"
        ? target
        : target.closest("a") || (target.tagName === "BUTTON" ? target : null);
    if (anchor) {
      if (anchor.tagName === "A") anchor.setAttribute("href", patch.href);
      else {
        anchor.setAttribute("data-href", patch.href);
      }
    }
  }
  if (patch.text != null) {
    const tag = target.tagName;
    if (tag === "IMG") {
      /* no text */
    } else if (tag === "A" || tag === "BUTTON" || /^H[1-6]$/.test(tag) || tag === "P" || tag === "SPAN" || tag === "LI") {
      // Preservar filhos de imagem; só texto simples
      if (!target.querySelector("img,picture,svg,video")) {
        target.textContent = patch.text;
      } else {
        // Substituir só nós de texto
        const texts = Array.from(target.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE);
        if (texts.length) {
          texts[0].textContent = patch.text;
          texts.slice(1).forEach((n) => n.parentNode?.removeChild(n));
        } else {
          target.insertBefore(document.createTextNode(patch.text), target.firstChild);
        }
      }
    } else if (!target.querySelector("img,picture,video,iframe")) {
      target.textContent = patch.text;
    }
  }
  if (patch.color != null) {
    if (patch.color === "") htmlEl.style.removeProperty("color");
    else htmlEl.style.color = patch.color;
  }
  if (patch.background != null) {
    if (patch.background === "") {
      htmlEl.style.removeProperty("background-color");
      htmlEl.style.removeProperty("background");
    } else {
      htmlEl.style.backgroundColor = patch.background;
    }
  }
  return el;
}

export function enableTextFieldsInRoot(root: ParentNode) {
  root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,span,a,button").forEach((el) => {
    if (el.closest("script,style")) return;
    if (el.querySelector("img,picture,video,iframe,table")) return;
    (el as HTMLElement).setAttribute(EDITABLE_ATTR, "1");
    (el as HTMLElement).contentEditable = "true";
  });
}

export function serializeHtmlFoldContent(wrap: HTMLElement): string {
  const clone = wrap.cloneNode(true) as HTMLElement;
  clearHtmlFoldSelectionMarks(clone);
  clone.querySelectorAll(`[${EDITABLE_ATTR}]`).forEach((n) => {
    n.removeAttribute(EDITABLE_ATTR);
    n.removeAttribute("contenteditable");
  });
  clone.querySelectorAll("style[data-clickora-html-editor]").forEach((n) => n.remove());
  return stripHtmlFoldEditorChrome(clone.innerHTML);
}

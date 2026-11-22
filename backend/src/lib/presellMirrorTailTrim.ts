import type { HTMLElement, Node } from "node-html-parser";

export const MIRROR_TAIL_HEIGHT_STYLE =
  '<style data-clickora="mirror-tail">' +
  "html,body{min-height:0!important;height:auto!important}" +
  "body>.clickora-mirror-tail-trim{display:none!important;height:0!important;overflow:hidden!important}" +
  "</style>";

const TRIM_TAGS = new Set([
  "div",
  "section",
  "footer",
  "header",
  "aside",
  "span",
  "p",
  "iframe",
  "noscript",
]);

const MEANINGFUL_SELECTOR =
  "img[src],picture source[srcset],video[src],audio[src],svg,tbody,table,form,input,select,textarea,button,a[href]";

function textIsEmpty(raw: string): boolean {
  return raw.replace(/\u00a0/g, " ").replace(/\s+/g, "").length === 0;
}

/** Últimos nós do body que só inflam scroll (min-height, iframes vazios, wrappers vazios). */
export function mirrorTrailingNodeIsSpacer(node: Node): boolean {
  if (node.nodeType === 3) {
    return textIsEmpty(String(node.rawText ?? ""));
  }
  if (node.nodeType !== 1) return false;
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase() ?? "";
  if (tag === "script" || tag === "style" || tag === "link") return true;
  if (!TRIM_TAGS.has(tag) && tag !== "iframe") return false;

  if (el.querySelector(MEANINGFUL_SELECTOR)) return false;
  const text = (el.textContent || "").replace(/\u00a0/g, " ");
  if (!textIsEmpty(text)) return false;

  if (tag === "iframe") {
    const src = (el.getAttribute("src") || "").trim().toLowerCase();
    if (!src || src === "about:blank") return true;
  }

  const style = (el.getAttribute("style") || "").toLowerCase();
  const cls = (el.getAttribute("class") || "").toLowerCase();
  const tallShell =
    /min-height\s*:\s*(100vh|100%|\d{4,}px)/.test(style) ||
    /\bmin-h-screen\b|\bmin-h-\[100vh\]|\bh-screen\b|\bmin-h-full\b/.test(cls);
  if (tallShell) return true;

  if (TRIM_TAGS.has(tag) && el.childNodes.length === 0) return true;

  /** Wrapper vazio com filhos também só espaçadores. */
  if (el.childNodes.length > 0 && el.childNodes.every((c) => mirrorTrailingNodeIsSpacer(c))) {
    return true;
  }

  return false;
}

export function trimMirrorTrailingSpacerNodes(body: HTMLElement): number {
  let removed = 0;
  for (let i = 0; i < 48; i++) {
    const nodes = body.childNodes;
    if (nodes.length === 0) break;
    const last = nodes[nodes.length - 1];
    if (!mirrorTrailingNodeIsSpacer(last)) break;
    last.remove();
    removed++;
  }
  return removed;
}

export function injectMirrorTailHeightStyle(html: string): string {
  if (html.includes('data-clickora="mirror-tail"')) return html;
  if (/<head\b/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${MIRROR_TAIL_HEIGHT_STYLE}`);
  }
  return MIRROR_TAIL_HEIGHT_STYLE + html;
}
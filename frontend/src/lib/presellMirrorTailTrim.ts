/**
 * Espelho sem JS: tails vazios (min-height 100vh, iframes em branco) inflacionam o scroll.
 * Mesma heurística que `backend/src/lib/presellMirrorTailTrim.ts`.
 */

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

export function mirrorTrailingNodeIsSpacer(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return textIsEmpty(node.textContent || "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
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

  if (TRIM_TAGS.has(tag) && el.children.length === 0) return true;

  const childNodes = Array.from(el.childNodes);
  if (childNodes.length > 0 && childNodes.every((c) => mirrorTrailingNodeIsSpacer(c))) {
    return true;
  }

  return false;
}

export function trimMirrorTrailingSpacerNodes(body: HTMLElement): number {
  let removed = 0;
  for (let i = 0; i < 48; i++) {
    if (body.lastChild == null) break;
    const last = body.lastChild;
    if (!mirrorTrailingNodeIsSpacer(last)) break;
    last.remove();
    removed++;
  }
  return removed;
}

export function trimMirrorTrailingSpacersInHtml(html: string): string {
  if (!html || html.length < 80) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.body) trimMirrorTrailingSpacerNodes(doc.body);
    const serialized = doc.documentElement.outerHTML;
    return injectMirrorTailHeightStyle(
      serialized.includes("<!DOCTYPE") ? serialized : `<!DOCTYPE html>${serialized}`,
    );
  } catch {
    return injectMirrorTailHeightStyle(html);
  }
}

export function injectMirrorTailHeightStyle(html: string): string {
  if (html.includes('data-clickora="mirror-tail"')) return html;
  if (/<head\b/i.test(html)) {
    return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${MIRROR_TAIL_HEIGHT_STYLE}`);
  }
  return MIRROR_TAIL_HEIGHT_STYLE + html;
}

/** Altura útil do documento no iframe (ignora cauda de scroll fantasma). */
export function measureMirrorDocumentContentHeight(doc: Document): number {
  const body = doc.body;
  if (!body) return 480;
  let maxBottom = 0;
  const nodes = body.querySelectorAll<HTMLElement>("img,video,picture,section,main,article,footer,header,div,p,h1,h2,h3,table,form");
  nodes.forEach((el) => {
    if (el.offsetHeight < 2 && el.offsetWidth < 2) return;
    const bottom = el.offsetTop + el.offsetHeight;
    if (bottom > maxBottom) maxBottom = bottom;
  });
  const scrollH = Math.max(
    body.scrollHeight,
    doc.documentElement?.scrollHeight ?? 0,
    body.offsetHeight,
  );
  if (maxBottom > 200 && maxBottom < scrollH - 64) {
    return Math.min(48_000, Math.ceil(maxBottom + 12));
  }
  return Math.min(48_000, Math.ceil(scrollH + 8));
}
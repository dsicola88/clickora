import { type HTMLElement, parse } from "node-html-parser";

/** Substituído no cliente pelo href real de tracking (evita dados sensíveis no HTML guardado). */
export const CLICKORA_MIRROR_TRACK_MARKER = "https://clickora.invalid/__TRACK_OFFER__";

const MAX_MIRROR_CHARS = 720_000;

function hostnameNoWww(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function escapeBaseHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Injetado antes do CSS original — base para mobile / overflow / media fluidos. */
export const MIRROR_RESPONSIVE_STYLE_IN_HEAD = `<style data-clickora="responsive-base">html{-webkit-text-size-adjust:100%;text-size-adjust:100%;}body{margin:0;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;overflow-wrap:anywhere;word-wrap:break-word;}*,*::before,*::after{box-sizing:border-box;}img,picture,video,canvas,svg{max-width:100%;height:auto;}iframe{max-width:100%;}table{max-width:100%;}</style>`;

export function buildMirrorSrcDocFromParts(baseHref: string, headSnip: string, bodyInner: string): string {
  const b = escapeBaseHref(baseHref.split("#")[0] || baseHref);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${MIRROR_RESPONSIVE_STYLE_IN_HEAD}<base href="${b}">${headSnip}</head><body>${bodyInner}</body></html>`;
}

/** Mantém iframes (vídeo, maps, widgets) com URL http(s) resolvida; remove pixels inválidos. */
function sanitizeMirrorIframes(root: HTMLElement, base: URL): void {
  root.querySelectorAll("iframe").forEach((ifr) => {
    const src = (ifr.getAttribute("src") || "").trim();
    if (!src || src.toLowerCase().startsWith("javascript:")) {
      ifr.remove();
      return;
    }
    try {
      const abs = new URL(src, base);
      if (abs.protocol !== "https:" && abs.protocol !== "http:") {
        ifr.remove();
        return;
      }
      ifr.setAttribute("src", abs.href);
      if (!ifr.getAttribute("referrerpolicy")) {
        ifr.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      }
    } catch {
      ifr.remove();
    }
  });
}

/**
 * Remove elementos perigosos, normaliza links da oferta para marcador de tracking,
 * força `target="_top"` para sair do iframe.
 */
export function finalizeMirrorSrcDocForImport(
  srcDoc: string,
  pageBaseUrl: string,
  affiliateUrl: string,
): string | null {
  const hosts = new Set<string>();
  const hPage = hostnameNoWww(pageBaseUrl);
  const hAff = hostnameNoWww(affiliateUrl);
  if (hPage) hosts.add(hPage);
  if (hAff) hosts.add(hAff);

  let base: URL;
  try {
    base = new URL(pageBaseUrl);
  } catch {
    return null;
  }

  const root = parse(srcDoc, { comment: true });
  root.querySelectorAll("script, object, embed, noscript").forEach((n) => n.remove());
  sanitizeMirrorIframes(root, base);

  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.trim().toLowerCase().startsWith("javascript:")) {
      return;
    }
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    const h = abs.hostname.replace(/^www\./, "").toLowerCase();
    a.setAttribute("target", "_top");
    a.setAttribute("rel", "noopener noreferrer");
    if (hosts.size > 0 && hosts.has(h)) {
      a.setAttribute("href", CLICKORA_MIRROR_TRACK_MARKER);
    } else {
      a.setAttribute("href", abs.href);
    }
  });

  let out = root.toString();
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  out = out.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  if (!out.includes("data-clickora=\"responsive-base\"")) {
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${MIRROR_RESPONSIVE_STYLE_IN_HEAD}`);
  }

  if (out.length > MAX_MIRROR_CHARS) {
    out = `${out.slice(0, MAX_MIRROR_CHARS)}\n<!-- clickora: mirror truncado -->`;
  }

  return out.length > 500 ? out : null;
}

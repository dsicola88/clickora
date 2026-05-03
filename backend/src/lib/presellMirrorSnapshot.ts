import { parse } from "node-html-parser";

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

export function buildMirrorSrcDocFromParts(baseHref: string, headSnip: string, bodyInner: string): string {
  const b = escapeBaseHref(baseHref.split("#")[0] || baseHref);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${b}">${headSnip}</head><body>${bodyInner}</body></html>`;
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
  root.querySelectorAll("script, iframe, noscript, object, embed").forEach((n) => n.remove());

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

  if (out.length > MAX_MIRROR_CHARS) {
    out = `${out.slice(0, MAX_MIRROR_CHARS)}\n<!-- clickora: mirror truncado -->`;
  }

  return out.length > 500 ? out : null;
}

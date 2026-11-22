/**
 * Sanitização defensiva do espelho embutido no HTML lite (`/l/:id`).
 * O AdsBot vê esta página sem sandbox — deve estar alinhada ao iframe público (sem executáveis).
 */
import { parse, type HTMLElement } from "node-html-parser";
import { stripHtmlMarketingExecutors } from "./stripHtmlMarketingExecutors";

/** CSP para documento lite — declarada em `getPublicHtml` quando o espelho é servido. */
export const PRESSELL_LITE_HTML_CSP =
  "default-src 'self' https: data: blob:; script-src 'none'; object-src 'none'; embed-src 'none'; base-uri 'none'; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://maps.google.com; form-action 'self' https:; upgrade-insecure-requests";

const LITE_IFRAME_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "google.com",
  "maps.google.com",
];

function hostAllowedForLiteIframe(hostname: string): boolean {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  return LITE_IFRAME_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function stripDangerousMetaAndBase(root: HTMLElement): void {
  root.querySelectorAll("base").forEach((n) => n.remove());
  root.querySelectorAll("link[rel]").forEach((node) => {
    const el = node as HTMLElement;
    const rel = (el.getAttribute("rel") || "").toLowerCase();
    if (rel.includes("import")) {
      el.remove();
      return;
    }
    const as = (el.getAttribute("as") || "").toLowerCase();
    if ((rel.includes("preload") || rel.includes("modulepreload")) && as === "script") {
      el.remove();
    }
  });
  root.querySelectorAll("meta[http-equiv]").forEach((node) => {
    const el = node as HTMLElement;
    const he = (el.getAttribute("http-equiv") || "").trim().toLowerCase();
    if (he === "refresh" || he === "set-cookie" || he === "content-security-policy") {
      el.remove();
    }
  });
}

function stripInlineEventHandlers(root: HTMLElement): void {
  root.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    const attrs = el.attributes as Record<string, string> | undefined;
    if (!attrs) return;
    for (const name of Object.keys(attrs)) {
      if (/^on/i.test(name)) el.removeAttribute(name);
    }
  });
}

function sanitizeLiteIframes(root: HTMLElement): void {
  root.querySelectorAll("iframe").forEach((node) => {
    const el = node as HTMLElement;
    const src = (el.getAttribute("src") || "").trim();
    if (!src || src.toLowerCase().startsWith("javascript:")) {
      el.remove();
      return;
    }
    try {
      const abs = new URL(src, "https://safe.invalid/");
      if (abs.protocol !== "https:" && abs.protocol !== "http:") {
        el.remove();
        return;
      }
      if (!hostAllowedForLiteIframe(abs.hostname)) {
        el.remove();
      }
    } catch {
      el.remove();
    }
  });
}

/**
 * Remove executáveis, redirects e embeds de risco antes de injetar o espelho no lite HTML.
 */
export function sanitizeMirrorEmbedForLiteHtml(html: string): string {
  if (!html || html.length < 1) return html;

  let out = stripHtmlMarketingExecutors(html);
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  out = out.replace(/<embed\b[^>]*\/?>/gi, "");
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "");
  out = out.replace(/<base\b[^>]*>/gi, "");

  try {
    const root = parse(out, { comment: true });
    root.querySelectorAll("script, object, embed, noscript").forEach((n) => n.remove());
    stripDangerousMetaAndBase(root);
    sanitizeLiteIframes(root);
    stripInlineEventHandlers(root);
    out = root.toString();
  } catch {
    /* regex fallback acima */
  }

  return stripHtmlMarketingExecutors(out);
}

/** Mesma política na SPA pública (`/p/`) — manter alinhado com o lite. */
export const sanitizeMirrorEmbedForPublic = sanitizeMirrorEmbedForLiteHtml;
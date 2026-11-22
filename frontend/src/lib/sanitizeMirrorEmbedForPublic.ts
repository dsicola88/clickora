/**
 * Sanitização defensiva do espelho na SPA pública (`/p/`).
 * Lógica alinhada com `backend/src/lib/sanitizeMirrorEmbedForLiteHtml.ts` (sem node-html-parser).
 */
import { stripHtmlMarketingExecutors } from "@/lib/stripHtmlMarketingExecutors";

const PUBLIC_IFRAME_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "google.com",
  "maps.google.com",
];

function hostAllowedForPublicIframe(hostname: string): boolean {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  return PUBLIC_IFRAME_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function stripDangerousNodes(doc: Document): void {
  doc.querySelectorAll("script, object, embed, noscript, base").forEach((n) => n.remove());
  doc.querySelectorAll("link[rel]").forEach((el) => {
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
  doc.querySelectorAll("meta[http-equiv]").forEach((el) => {
    const he = (el.getAttribute("http-equiv") || "").trim().toLowerCase();
    if (he === "refresh" || he === "set-cookie" || he === "content-security-policy") {
      el.remove();
    }
  });
  doc.querySelectorAll("iframe").forEach((el) => {
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
      if (!hostAllowedForPublicIframe(abs.hostname)) {
        el.remove();
      }
    } catch {
      el.remove();
    }
  });
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
  });
}

function serializeSanitized(doc: Document, originalHadHtml: boolean): string {
  if (originalHadHtml) {
    return doc.documentElement.outerHTML;
  }
  return doc.body.innerHTML;
}

export function sanitizeMirrorEmbedForPublic(html: string): string {
  if (!html) return html;

  let out = stripHtmlMarketingExecutors(html);
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  out = out.replace(/<embed\b[^>]*\/?>/gi, "");
  out = out.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "");
  out = out.replace(/<base\b[^>]*>/gi, "");

  const originalHadHtml = /<html[\s>]/i.test(out);

  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(out, "text/html");
      stripDangerousNodes(doc);
      out = serializeSanitized(doc, originalHadHtml);
    } catch {
      /* regex fallback */
    }
  }

  return stripHtmlMarketingExecutors(out);
}
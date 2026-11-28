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
  const OPTOUT_TEXT_RE =
    /\b(unsubscribe|opt[\s-]?out|manage\s+(?:email\s+)?preferences|email\s+preferences|stop\s+receiving|remove\s+(?:me\s+)?from\s+(?:this\s+)?list|cancelar\s+subscri[cç][aã]o|descadastrar)\b/i;
  const OPTOUT_URL_RE =
    /(?:\/o-[a-z0-9]{2,}-[a-z0-9]{2,}-[0-9a-f]{12,}(?:[/?#]|$)|(?:^|[/?&._-])(unsubscribe|opt[-_]?out|list[-_]?unsubscribe|email[-_]?preferences)(?:$|[/?=&#._-]))/i;
  const OPEN_REDIRECT_PARAM_RE =
    /[?&](redirect|url|next|return|dest|destination|continue|redir|go|out)=https?:\/\//i;
  doc.querySelectorAll("a, area").forEach((el) => {
    const href = (el.getAttribute("href") || "").trim();
    const label = `${el.textContent || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`
      .replace(/\s+/g, " ")
      .trim();
    if ((label && OPTOUT_TEXT_RE.test(label)) || (href && OPTOUT_URL_RE.test(href))) {
      const parent = el.parentElement;
      el.remove();
      if (parent && parent.tagName === "LI" && !parent.textContent?.trim() && !parent.querySelector("a,button,img,svg,input")) {
        parent.remove();
      }
      return;
    }
    if (href && /^(javascript|vbscript|data):/i.test(href)) {
      el.removeAttribute("href");
      if (!label) el.remove();
      return;
    }
    if (href && OPEN_REDIRECT_PARAM_RE.test(href) && !/\/track\/r\//i.test(href) && !href.includes("__TRACK_OFFER__")) {
      el.remove();
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
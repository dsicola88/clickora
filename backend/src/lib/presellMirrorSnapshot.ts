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

/** Hostnames típicos de checkout / plataformas de afiliados (Hoplink pode ser outro domínio que o carrinho). */
const COMMERCE_HOST_MARKERS = [
  "buygoods",
  "clickbank.net",
  "clickbank.com",
  "digistore",
  "hotmart",
  "kiwify",
  "cartpanda",
  "paylix",
  "jvzoo",
  "warriorplus",
  "stripe.com",
  "paypal.com",
  "whop.com",
  "gumroad.com",
  "lemonsqueezy.com",
];

function hostLooksLikeCommerceOrCheckout(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return COMMERCE_HOST_MARKERS.some((m) => h.includes(m));
}

function pathOrQueryLooksLikeCheckout(abs: URL): boolean {
  const s = `${abs.pathname}${abs.search}`.toLowerCase();
  return (
    /(\/secure\/checkout|\/checkout\.html|\/checkout\/|\/checkout\?|\/cart\/|\/cart\?|\/order\/|\/buy\b|\/purchase|\/pay\b|aff_id=|affiliate[_-]?id=|vendor[_-]?id=|cbfid=|cbexit|cbtimer|tid=|item[_-]?number=)/i.test(
      s,
    ) || /[?&](aff_id|affiliate_id|hop|tid|vendor|cbfid|item|itemnumber)=/i.test(s)
  );
}

/**
 * Ligações que devem usar o hoplink rastreado da presell (marcador), não a URL crua da página clonada.
 * Além do host da página / do Hoplink configurado, incluímos checkouts comuns (ex.: buygoods.com).
 */
export function mirrorUrlShouldUseTrackMarker(abs: URL, hosts: Set<string>): boolean {
  if (abs.protocol !== "http:" && abs.protocol !== "https:") return false;
  const path = abs.pathname.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|svg|ico|mp4|webm|pdf|zip|css|js|mjs|map|woff2?|ttf|otf|eot)(\?|$)/.test(path)) {
    return false;
  }
  const h = abs.hostname.replace(/^www\./, "").toLowerCase();
  if (hosts.size > 0 && hosts.has(h)) return true;
  if (hostLooksLikeCommerceOrCheckout(abs.hostname)) return true;
  if (pathOrQueryLooksLikeCheckout(abs)) return true;
  return false;
}

function escapeBaseHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Os mirrors removem `<script>` e depois cortam `on*`; botões que só navegam com `onclick`
 * ficam mortos. Extraímos URLs em `onclick` comuns antes desse passo para sintetizar `<a href>`.
 */
export function tryExtractUrlFromInlineHandler(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const patterns: RegExp[] = [
    /window\.open\s*\(\s*['"]([^'"]+)['"]/i,
    /location\.(?:assign|replace)\s*\(\s*['"]([^'"]+)['"]/i,
    /(?:(?:window|top|parent)\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    const u = m?.[1]?.trim();
    if (u && !u.toLowerCase().startsWith("javascript:")) return u;
  }
  return null;
}

function findAncestorForm(el: HTMLElement): HTMLElement | null {
  let p = el.parentNode as HTMLElement | null;
  while (p) {
    if (p.tagName?.toLowerCase() === "form") return p;
    p = p.parentNode as HTMLElement | null;
  }
  return null;
}

function copyMirrorPresentationAttrs(from: HTMLElement, to: HTMLElement): void {
  for (const name of ["class", "id", "style", "aria-label", "title"]) {
    const v = from.getAttribute(name);
    if (v) to.setAttribute(name, v);
  }
}

function mirrorApplyHrefToAnchor(a: HTMLElement, hrefValue: string): void {
  a.setAttribute("href", hrefValue);
  a.setAttribute("target", "_top");
  a.setAttribute("rel", "noopener noreferrer");
  a.removeAttribute("onclick");
}

type MirrorNavInnerMode = "children" | "inputValue" | "inputImage";

function mirrorReplaceWithNavAnchor(el: HTMLElement, hrefValue: string, innerMode: MirrorNavInnerMode): void {
  const doc = parse("<html><body><a></a></body></html>", { comment: true });
  const a = doc.querySelector("a");
  if (!a) return;
  copyMirrorPresentationAttrs(el, a);
  if (innerMode === "children") {
    a.innerHTML = el.innerHTML;
  } else if (innerMode === "inputImage") {
    const label =
      el.getAttribute("alt")?.trim() ||
      el.getAttribute("value")?.trim() ||
      el.getAttribute("aria-label")?.trim() ||
      el.getAttribute("title")?.trim() ||
      "Continue";
    a.textContent = label;
  } else {
    const label =
      el.getAttribute("value")?.trim() ||
      el.getAttribute("aria-label")?.trim() ||
      el.getAttribute("title")?.trim() ||
      "Continue";
    a.textContent = label;
  }
  mirrorApplyHrefToAnchor(a, hrefValue);
  el.replaceWith(a);
}

function rewriteFormActionsForMirror(root: HTMLElement, base: URL, hosts: Set<string>): void {
  const patchFormTarget = (form: HTMLElement | null) => {
    if (!form || form.tagName?.toLowerCase() !== "form") return;
    form.setAttribute("target", "_top");
  };

  const rewriteUrlAttr = (el: HTMLElement, attr: "action" | "formaction") => {
    const v = el.getAttribute(attr)?.trim();
    if (!v || v.startsWith("#") || v.trim().toLowerCase().startsWith("javascript:")) return;
    let abs: URL;
    try {
      abs = new URL(v, base);
    } catch {
      return;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
    if (!mirrorUrlShouldUseTrackMarker(abs, hosts)) return;
    el.setAttribute(attr, CLICKORA_MIRROR_TRACK_MARKER);
    if (attr === "action") {
      patchFormTarget(el);
    } else {
      patchFormTarget(findAncestorForm(el));
    }
  };

  root.querySelectorAll("form[action]").forEach((f) => rewriteUrlAttr(f as HTMLElement, "action"));
  root.querySelectorAll("[formaction]").forEach((el) => rewriteUrlAttr(el as HTMLElement, "formaction"));
}

const DATA_NAV_ATTRS = ["data-href", "data-url", "data-link", "data-target-href", "data-checkout-url"] as const;

/** URLs em data-* (comum em React/Vue) — o espelho não executa JS, por isso sintetizamos `<a href>`. */
function rewriteDataAttrNavigatorsForMirror(root: HTMLElement, base: URL, hosts: Set<string>): void {
  for (const attr of DATA_NAV_ATTRS) {
    root.querySelectorAll(`[${attr}]`).forEach((node) => {
      const el = node as HTMLElement;
      const raw = el.getAttribute(attr)?.trim();
      if (!raw) return;
      let hrefForParse = raw;
      if (hrefForParse.startsWith("//")) hrefForParse = `https:${hrefForParse}`;
      if (!/^https?:\/\//i.test(hrefForParse)) return;
      let abs: URL;
      try {
        abs = new URL(hrefForParse, base);
      } catch {
        return;
      }
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      if (!mirrorUrlShouldUseTrackMarker(abs, hosts)) return;
      el.removeAttribute(attr);
      const hrefValue = CLICKORA_MIRROR_TRACK_MARKER;
      const tag = el.tagName?.toLowerCase() ?? "";
      if (tag === "a") {
        mirrorApplyHrefToAnchor(el, hrefValue);
        return;
      }
      if (tag === "button") {
        mirrorReplaceWithNavAnchor(el, hrefValue, "children");
        return;
      }
      if (tag === "input") {
        const t = (el.getAttribute("type") || "text").toLowerCase();
        if (t === "button" || t === "submit") {
          mirrorReplaceWithNavAnchor(el, hrefValue, "inputValue");
          return;
        }
        if (t === "image") {
          mirrorReplaceWithNavAnchor(el, hrefValue, "inputImage");
        }
        return;
      }
      if (tag === "div" || tag === "span") {
        mirrorReplaceWithNavAnchor(el, hrefValue, "children");
      }
    });
  }
}

function rewriteOnclickNavigatorsForMirror(root: HTMLElement, base: URL, hosts: Set<string>): void {
  root.querySelectorAll("[onclick]").forEach((node) => {
    const el = node as HTMLElement;
    const handler = el.getAttribute("onclick");
    if (!handler) return;
    const rawUrl = tryExtractUrlFromInlineHandler(handler);
    if (!rawUrl) return;
    let abs: URL;
    try {
      abs = new URL(rawUrl, base);
    } catch {
      return;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
    const hrefValue = mirrorUrlShouldUseTrackMarker(abs, hosts) ? CLICKORA_MIRROR_TRACK_MARKER : abs.href;

    const tag = el.tagName?.toLowerCase() ?? "";

    if (tag === "a") {
      mirrorApplyHrefToAnchor(el, hrefValue);
      return;
    }

    if (tag === "button") {
      mirrorReplaceWithNavAnchor(el, hrefValue, "children");
      return;
    }

    if (tag === "input") {
      const t = (el.getAttribute("type") || "text").toLowerCase();
      if (t === "button" || t === "submit") {
        mirrorReplaceWithNavAnchor(el, hrefValue, "inputValue");
        return;
      }
      if (t === "image") {
        mirrorReplaceWithNavAnchor(el, hrefValue, "inputImage");
        return;
      }
    }

    const role = (el.getAttribute("role") || "").toLowerCase();
    if ((tag === "div" || tag === "span") && (role === "button" || role === "link")) {
      mirrorReplaceWithNavAnchor(el, hrefValue, "children");
    }
  });
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
    a.setAttribute("target", "_top");
    a.setAttribute("rel", "noopener noreferrer");
    if (mirrorUrlShouldUseTrackMarker(abs, hosts)) {
      a.setAttribute("href", CLICKORA_MIRROR_TRACK_MARKER);
    } else {
      a.setAttribute("href", abs.href);
    }
  });

  rewriteFormActionsForMirror(root, base, hosts);
  rewriteDataAttrNavigatorsForMirror(root, base, hosts);
  rewriteOnclickNavigatorsForMirror(root, base, hosts);

  let out = root.toString();
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  out = out.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  if (!out.includes("data-clickora=\"responsive-base\"")) {
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${MIRROR_RESPONSIVE_STYLE_IN_HEAD}`);
  }

  if (out.length > MAX_MIRROR_CHARS) {
    out = truncateMirrorHtmlToLimit(out, MAX_MIRROR_CHARS);
  }

  return out.length > 500 ? out : null;
}

/**
 * Nunca cortar a meio de uma tag — evita CSS e markup a aparecerem como texto no iframe.
 */
function truncateMirrorHtmlToLimit(html: string, maxChars: number): string {
  if (html.length <= maxChars) return html;
  let root: HTMLElement;
  try {
    root = parse(html, { comment: true }) as HTMLElement;
  } catch {
    const cut = html.lastIndexOf(">", Math.min(html.length - 1, maxChars - 48));
    const base = cut > maxChars * 0.85 ? cut + 1 : maxChars - 40;
    return `${html.slice(0, Math.max(0, base))}\n<!-- clickora: mirror truncado -->`;
  }

  for (let guard = 0; guard < 3000; guard++) {
    if (root.toString().length <= maxChars) break;
    const body = root.querySelector("body");
    if (body?.lastChild) {
      body.lastChild.remove();
      continue;
    }
    const head = root.querySelector("head");
    if (head?.lastChild) {
      head.lastChild.remove();
      continue;
    }
    break;
  }

  let out = root.toString();
  if (out.length > maxChars) {
    const sliceAt = Math.min(out.length - 1, maxChars - 48);
    const cut = out.lastIndexOf(">", sliceAt);
    const base = cut > maxChars * 0.88 ? cut + 1 : sliceAt;
    out = `${out.slice(0, Math.max(0, base))}\n<!-- clickora: mirror truncado -->`;
  }
  return out;
}

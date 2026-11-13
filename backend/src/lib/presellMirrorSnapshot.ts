import { type HTMLElement, parse } from "node-html-parser";

/** Substituído no cliente pelo href real de tracking (evita dados sensíveis no HTML guardado). */
export const CLICKORA_MIRROR_TRACK_MARKER = "https://clickora.invalid/__TRACK_OFFER__";

const MAX_MIRROR_CHARS = 1_400_000;

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
  "mycartpanda",
  "paylix",
  "jvzoo",
  "warriorplus",
  "stripe.com",
  "paypal.com",
  "whop.com",
  "gumroad.com",
  "lemonsqueezy.com",
  "mwebinsight.com",
  "mwebdatawatch.com",
  "mwebkivo.com",
  "knownwalk.com",
  "everflow",
  "maxweb",
  "shopify",
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

/** Base mínima — não altera tipografia/layout do original (fidelidade 1:1). */
export const MIRROR_RESPONSIVE_STYLE_IN_HEAD = `<style data-clickora="responsive-base">html,body{margin:0;}</style>`;

export const MIRROR_CTA_READABILITY_STYLE = "";

function ensureMirrorOfferAnchorLabels(root: ReturnType<typeof parse>): void {
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href.includes("__TRACK") && !href.includes("/track/")) return;
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length >= 2) return;
    const fallback =
      a.getAttribute("aria-label")?.trim() ||
      a.getAttribute("title")?.trim() ||
      "Order Now";
    a.textContent = fallback;
  });
}

export function buildMirrorSrcDocFromParts(baseHref: string, headSnip: string, bodyInner: string): string {
  const b = escapeBaseHref(baseHref.split("#")[0] || baseHref);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${MIRROR_RESPONSIVE_STYLE_IN_HEAD}<base href="${b}">${headSnip}</head><body>${bodyInner}</body></html>`;
}

const MAX_STATIC_HEAD = 480_000;
const MAX_STATIC_BODY = 950_000;

/**
 * Fallback quando Playwright não está disponível: extrai head (CSS/fonts) + body
 * do HTML estático do fetch para montar o espelho white.
 */
export function buildMirrorPartsFromStaticHtml(
  html: string,
  pageUrl: string,
): { baseHref: string; headSnip: string; bodyInner: string } | null {
  const trimmed = html.trim();
  if (trimmed.length < 800) return null;

  let baseHref = pageUrl.split("#")[0] || pageUrl;
  try {
    baseHref = new URL(baseHref).href;
  } catch {
    return null;
  }

  let root: HTMLElement;
  try {
    root = parse(trimmed, { comment: true }) as HTMLElement;
  } catch {
    return null;
  }

  const headParts: string[] = [];
  const head = root.querySelector("head");
  if (head) {
    head.querySelectorAll("meta[charset], meta[name='viewport'], meta[name='theme-color']").forEach((el) => {
      headParts.push(el.toString());
    });
    head.querySelectorAll("base").forEach((el) => {
      const href = el.getAttribute("href");
      if (!href) return;
      try {
        baseHref = new URL(href, baseHref).href;
      } catch {
        /* keep */
      }
    });
    head.querySelectorAll("link, style").forEach((el) => {
      if (el.tagName.toLowerCase() === "link") {
        const rel = (el.getAttribute("rel") || "").toLowerCase();
        if (
          rel === "alternate" ||
          rel === "canonical" ||
          rel === "modulepreload" ||
          rel === "prefetch" ||
          rel === "dns-prefetch"
        ) {
          return;
        }
        const asAttr = (el.getAttribute("as") || "").toLowerCase();
        if (asAttr === "script") return;
        if (rel.includes("stylesheet") || rel === "preconnect" || rel === "preload" || rel.includes("icon") || !rel) {
          const href = el.getAttribute("href");
          if (href) {
            try {
              el.setAttribute("href", new URL(href, baseHref).href);
            } catch {
              /* keep */
            }
          }
          headParts.push(el.toString());
        }
        return;
      }
      headParts.push(el.toString());
    });
    while (headParts.join("\n").length > MAX_STATIC_HEAD && headParts.length > 0) {
      headParts.pop();
    }
  }

  const body = root.querySelector("body");
  let bodyInner = body ? body.innerHTML : trimmed;
  if (!body) {
    const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch?.[1]) bodyInner = bodyMatch[1];
  }
  bodyInner = bodyInner
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "");
  if (bodyInner.length > MAX_STATIC_BODY) {
    bodyInner = bodyInner.slice(0, MAX_STATIC_BODY);
  }
  if (bodyInner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length < 40) {
    return null;
  }
  return { baseHref, headSnip: headParts.join("\n"), bodyInner };
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

/** Maior candidato de um srcset (`url 1200w` ou `url 2x`). Sem descritor, width fica 0. */
export function largestUrlInSrcset(srcset: string): { url: string; width: number } | null {
  let best: { url: string; width: number } | null = null;
  for (const part of srcset.split(",")) {
    const bit = part.trim();
    if (!bit) continue;
    const m = bit.match(/^(\S+)(?:\s+(\d+)w)?(?:\s+([\d.]+)x)?$/i);
    if (!m?.[1]) continue;
    const width = m[2] ? parseInt(m[2], 10) : m[3] ? Math.round(parseFloat(m[3]) * 400) : 0;
    if (!best || width > best.width) best = { url: m[1], width };
  }
  return best;
}

/** Largura declarada no próprio URL (Shopify, WordPress, query width). 0 se não houver. */
export function hintedImageWidth(url: string): number {
  const q = url.match(/(?:[?&](?:w|width|imwidth)=)(\d{2,4})\b/i);
  if (q) return Number(q[1]);
  const shop = url.match(/_(\d{2,4})x\d{0,4}\.(?:jpe?g|png|webp|gif|avif)(?:\?|#|$)/i);
  if (shop) return Number(shop[1]);
  const wp = url.match(/-(\d{2,4})x(\d{2,4})\.(?:jpe?g|png|webp|gif|avif)(?:\?|#|$)/i);
  if (wp) return Number(wp[1]);
  return 0;
}

/** Extrai URL de `bg-[url(...)]` / `tw-bg-[url(...)]` / `md:tw-bg-[url(...)]` no class. */
const TW_BG_URL_IN_CLASS =
  /(?:^|\s)(?:[\w-]+:)*(?:tw-)?bg-\[url\((['"]?)([^'")\]]+)\1\)\]/gi;

function absolutizeMirrorAssetUrl(raw: string, base: URL): string | null {
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned || cleaned.startsWith("data:") || cleaned.startsWith("#")) return null;
  try {
    const abs = new URL(cleaned, base);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    return abs.href;
  } catch {
    return null;
  }
}

function mergeInlineStyle(el: HTMLElement, patch: string): void {
  const prev = (el.getAttribute("style") || "").trim().replace(/;?\s*$/, "");
  el.setAttribute("style", prev ? `${prev}; ${patch}` : patch);
}

/** Reescreve `url(...)` relativos dentro de CSS para absolutos (mantém data:/http). */
function absolutizeCssUrls(css: string, base: URL): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, q: string, raw: string) => {
    const abs = absolutizeMirrorAssetUrl(raw || "", base);
    if (!abs) return full;
    return `url(${abs})`;
  });
}

/**
 * Tailwind JIT `bg-[url(...)]` só funciona se a classe exacta existir no CSS compilado.
 * Absolutizar o path dentro da classe parte o match → 1ª dobra sem imagem.
 * Solução: promover para `style="background-image:…"` (e lazy `data-src` → `src`).
 */
export function promoteMirrorBackgroundUrlsToInline(root: HTMLElement, base: URL): void {
  root.querySelectorAll("[class]").forEach((node) => {
    const el = node as HTMLElement;
    const cls = el.getAttribute("class") || "";
    if (!/bg-\[url\(/i.test(cls)) return;
    let chosen: string | null = null;
    TW_BG_URL_IN_CLASS.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TW_BG_URL_IN_CLASS.exec(cls))) {
      const abs = absolutizeMirrorAssetUrl(m[2] || "", base);
      if (abs) chosen = abs; // última (ex. md:) ganha — tipicamente desktop
    }
    if (!chosen) return;
    const style = el.getAttribute("style") || "";
    // `background-image: var(--header-bg)` não basta se o bake anular o <base>.
    if (/background-image\s*:\s*url\(/i.test(style)) return;
    if (/background-image\s*:/i.test(style)) {
      el.setAttribute(
        "style",
        style.replace(
          /background-image\s*:[^;]+/i,
          `background-image:url(${chosen})`,
        ),
      );
      return;
    }
    mergeInlineStyle(
      el,
      // Sem aspas no url() — node-html-parser escapa " para &quot; e parte o CSS.
      `background-image:url(${chosen});background-size:cover;background-position:top center;background-repeat:no-repeat;min-height:min(72vh,560px)`,
    );
  });

  // Absolutizar url() em <style> (CSS vars / backgrounds) — scripts lazy foram removidos.
  const varUrls = new Map<string, string>();
  root.querySelectorAll("style").forEach((styleNode) => {
    const css = styleNode.text || "";
    if (!css || !/url\(/i.test(css)) return;
    const next = absolutizeCssUrls(css, base);
    if (next !== css) styleNode.set_content(next);
    const re = /--([a-z0-9-_]*bg[a-z0-9-_]*)\s*:\s*url\(\s*(['"]?)([^'")]+)\2\s*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(next))) {
      const abs = absolutizeMirrorAssetUrl(m[3] || "", base);
      if (abs) varUrls.set(m[1].toLowerCase(), abs);
    }
  });

  // Preferir desktop header; fallback mobile.
  const headerBg = varUrls.get("header-bg");
  if (headerBg) {
    const hero =
      (root.querySelector(".hero") as HTMLElement | null) ||
      (root.querySelector("[class*='hero']") as HTMLElement | null);
    if (hero) {
      const style = hero.getAttribute("style") || "";
      if (/background-image\s*:\s*url\(/i.test(style)) {
        /* já tem url() absoluto */
      } else if (/background-image\s*:/i.test(style)) {
        hero.setAttribute(
          "style",
          style.replace(/background-image\s*:[^;]+/i, `background-image:url(${headerBg})`),
        );
      } else {
        mergeInlineStyle(
          hero,
          `background-image:url(${headerBg});background-size:cover;background-position:top center;background-repeat:no-repeat;min-height:min(72vh,560px)`,
        );
      }
    }
  }
}

function absolutizeSrcsetAttr(raw: string, base: URL): string {
  return raw
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const bits = trimmed.split(/\s+/);
      const url = bits[0] || "";
      const abs = absolutizeMirrorAssetUrl(url, base);
      if (!abs) return trimmed;
      return [abs, ...bits.slice(1)].join(" ");
    })
    .join(", ");
}

/**
 * O bake do cliente neutraliza `<base href>` do merchant (`./`) para CTAs não
 * saírem para o lander — mas isso parte `src`/`href` relativos. Absolutizar
 * todos os assets no import torna o espelho independente do `<base>`.
 */
export function absolutizeMirrorDocumentAssets(root: HTMLElement, base: URL): void {
  const bumpAttr = (el: HTMLElement, name: string) => {
    const raw = el.getAttribute(name);
    if (!raw || !raw.trim()) return;
    if (name === "srcset") {
      el.setAttribute(name, absolutizeSrcsetAttr(raw, base));
      return;
    }
    const abs = absolutizeMirrorAssetUrl(raw, base);
    if (abs) el.setAttribute(name, abs);
  };

  root.querySelectorAll("img").forEach((img) => {
    const el = img as HTMLElement;
    bumpAttr(el, "src");
    bumpAttr(el, "srcset");
    bumpAttr(el, "data-src");
    bumpAttr(el, "data-lazy-src");
    bumpAttr(el, "data-original");
  });
  root.querySelectorAll("source").forEach((source) => {
    const el = source as HTMLElement;
    bumpAttr(el, "src");
    bumpAttr(el, "srcset");
  });
  root.querySelectorAll("video").forEach((video) => {
    const el = video as HTMLElement;
    bumpAttr(el, "src");
    bumpAttr(el, "poster");
  });
  root.querySelectorAll("link[href]").forEach((link) => {
    const el = link as HTMLElement;
    const rel = (el.getAttribute("rel") || "").toLowerCase();
    if (!/(stylesheet|preload|icon|apple-touch-icon|image_src)/.test(rel)) return;
    bumpAttr(el, "href");
  });
  root.querySelectorAll("[style]").forEach((node) => {
    const el = node as HTMLElement;
    const style = el.getAttribute("style") || "";
    if (!/url\(/i.test(style)) return;
    const next = absolutizeCssUrls(style, base);
    if (next !== style) el.setAttribute("style", next);
  });
}

/** Lazy-load sem JS no iframe: `data-src` / `data-lazy-src` → `src`. */
export function promoteMirrorLazyImagesToSrc(root: HTMLElement, base: URL): void {
  root.querySelectorAll("img").forEach((img) => {
    const el = img as HTMLElement;
    const current = (el.getAttribute("src") || "").trim();
    const lazy =
      el.getAttribute("data-src") ||
      el.getAttribute("data-lazy-src") ||
      el.getAttribute("data-original") ||
      "";
    if (!lazy.trim()) return;
    const looksEmpty =
      !current ||
      current.startsWith("data:image/svg") ||
      /placeholder|spacer|blank|1x1|pixel/i.test(current) ||
      // Mesmo path relativo no src e data-src — forçar absoluto + eager.
      current === lazy.trim();
    if (!looksEmpty) return;
    const abs = absolutizeMirrorAssetUrl(lazy, base);
    if (abs) {
      el.setAttribute("src", abs);
      el.removeAttribute("loading");
    }
  });
}

/**
 * Se o `src` é uma miniatura e o srcset (ou o `<source>` do `<picture>`) tem um ficheiro maior
 * da mesma imagem, passa esse URL para `src`. O srcset mantém-se para o browser escolher.
 */
export function promoteLargestMirrorImageSrc(root: HTMLElement, base: URL): void {
  root.querySelectorAll("img").forEach((img) => {
    let bestUrl = "";
    let bestW = 0;
    const consider = (raw: string | null | undefined) => {
      if (!raw) return;
      const hit = largestUrlInSrcset(raw);
      if (hit && hit.width > bestW && hit.url) {
        bestW = hit.width;
        bestUrl = hit.url;
      }
    };
    consider(img.getAttribute("srcset"));
    const parent = img.parentNode as HTMLElement | null;
    if (parent && parent.tagName?.toLowerCase() === "picture") {
      parent.querySelectorAll("source").forEach((source) => consider(source.getAttribute("srcset")));
    }
    if (!bestUrl || bestW < 320) return;
    const current = img.getAttribute("src") || "";
    const curW = hintedImageWidth(current);
    if (curW > 0 && bestW <= curW + 40) return;
    try {
      const abs = new URL(bestUrl, base);
      if (abs.protocol === "http:" || abs.protocol === "https:") img.setAttribute("src", abs.href);
    } catch {
      img.setAttribute("src", bestUrl);
    }
  });
}

/** Remove marcas do modo edição visual efémero (nunca persistir na presell pública). */
export function stripEphemeralMirrorEditMarks(root: HTMLElement): void {
  root.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  root.querySelectorAll("style[data-clickora-mirror-edit]").forEach((n) => n.remove());
  root.querySelectorAll(".editable-element").forEach((n) => {
    n.classList.remove("editable-element");
    const cls = n.getAttribute("class")?.trim();
    if (!cls) n.removeAttribute("class");
  });
}

/**
 * HTML capturado do iframe de edição → documento limpo (sem contenteditable) + CTAs/track intactos.
 */
export function sanitizeMirrorSrcDocFromEditor(
  raw: string,
  pageBaseUrl: string,
  affiliateUrl: string,
): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 80) return null;

  const baseForDoc = pageBaseUrl.trim() || affiliateUrl.trim() || "https://example.invalid/";
  let docHtml = trimmed;
  if (!/<html[\s>]/i.test(trimmed)) {
    let bodyInner = trimmed;
    const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch?.[1]) bodyInner = bodyMatch[1];
    docHtml = buildMirrorSrcDocFromParts(baseForDoc, "", bodyInner);
  }

  let root: HTMLElement;
  try {
    root = parse(docHtml, { comment: true }) as HTMLElement;
  } catch {
    return null;
  }
  stripEphemeralMirrorEditMarks(root);
  const affiliate = affiliateUrl.trim() || baseForDoc;
  return finalizeMirrorSrcDocForImport(root.toString(), baseForDoc, affiliate);
}

/**
 * Fallback string-level: atributos de asset relativos → absolutos.
 * Necessário quando `node-html-parser` falha em tags com classes Tailwind `-[…]`.
 */
export function absolutizeRelativeAssetUrlsInHtmlString(html: string, base: URL): string {
  const skipHref = (raw: string) => {
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith("mailto:") || t.startsWith("tel:")) return true;
    if (t.startsWith("javascript:") || t.startsWith("data:") || t.startsWith("blob:")) return true;
    if (/^https?:\/\//i.test(t) || t.startsWith("//")) return true;
    if (t.includes("__TRACK_OFFER__") || /\/track\/r\//i.test(t)) return true;
    return false;
  };

  let out = html;
  out = out.replace(
    /\b(src|poster|data-src|data-lazy-src|data-original|href)\s*=\s*(["'])([^"']*)\2/gi,
    (full, attr: string, q: string, raw: string) => {
      if (skipHref(raw)) return full;
      // href: só assets (css/img/font) — não reescrever rotas de página aqui
      if (attr.toLowerCase() === "href") {
        if (!/\.(css|js|png|jpe?g|gif|webp|svg|avif|woff2?|ttf|eot|ico)(\?|#|$)/i.test(raw)) {
          return full;
        }
      }
      const abs = absolutizeMirrorAssetUrl(raw, base);
      return abs ? `${attr}=${q}${abs}${q}` : full;
    },
  );
  out = out.replace(/\bsrcset\s*=\s*(["'])([^"']*)\1/gi, (full, q: string, raw: string) => {
    if (!raw.trim()) return full;
    return `srcset=${q}${absolutizeSrcsetAttr(raw, base)}${q}`;
  });
  return out;
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
  // Antes do bake do cliente anular <base>: assets absolutos sobrevivem a href="./".
  absolutizeMirrorDocumentAssets(root, base);
  promoteMirrorLazyImagesToSrc(root, base);
  promoteLargestMirrorImageSrc(root, base);
  promoteMirrorBackgroundUrlsToInline(root, base);
  sanitizeMirrorIframes(root, base);

  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    const label = `${a.textContent || ""} ${a.getAttribute("aria-label") || ""}`;
    const offerCta =
      /order\s*now|buy\s*now|add to cart|comprar agora|shop now|checkout|get started|go directly|official site|official shop|get\s+[\w\s]{0,48}official|claim\s+offer|secure\s+order|ver oferta|continuar/i.test(
        label,
      );
    if (!href || href.trim().toLowerCase().startsWith("javascript:")) {
      if (offerCta) {
        a.setAttribute("href", CLICKORA_MIRROR_TRACK_MARKER);
        a.setAttribute("target", "_top");
        a.setAttribute("rel", "noopener noreferrer");
      }
      return;
    }
    if (href.startsWith("#")) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    a.setAttribute("target", "_top");
    a.setAttribute("rel", "noopener noreferrer");
    if (mirrorUrlShouldUseTrackMarker(abs, hosts) || offerCta) {
      a.setAttribute("href", CLICKORA_MIRROR_TRACK_MARKER);
    } else {
      a.setAttribute("href", abs.href);
    }
  });

  rewriteFormActionsForMirror(root, base, hosts);
  rewriteDataAttrNavigatorsForMirror(root, base, hosts);
  rewriteOnclickNavigatorsForMirror(root, base, hosts);
  ensureMirrorOfferAnchorLabels(root);

  let out = root.toString();
  // Tailwind `class="…[22px]…"` parte o parser em alguns nós — regex cobre o resto.
  out = absolutizeRelativeAssetUrlsInHtmlString(out, base);
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  out = out.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  if (!out.includes("data-clickora=\"responsive-base\"")) {
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${MIRROR_RESPONSIVE_STYLE_IN_HEAD}`);
  }
  if (MIRROR_CTA_READABILITY_STYLE && !out.includes("data-clickora=\"cta-readability\"")) {
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${MIRROR_CTA_READABILITY_STYLE}`);
  }
  out = out.replace(/<style\b[^>]*data-clickora="cta-readability"[^>]*>[\s\S]*?<\/style>/gi, "");

  if (out.length > MAX_MIRROR_CHARS) {
    out = truncateMirrorHtmlToLimit(out, MAX_MIRROR_CHARS);
  }

  return out.length > 200 ? out : null;
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

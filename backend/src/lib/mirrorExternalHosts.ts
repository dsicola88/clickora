import { type HTMLElement, parse } from "node-html-parser";
import { CLICKORA_MIRROR_TRACK_MARKER, hostLooksLikeCommerceOrCheckout } from "./presellMirrorSnapshot";

/**
 * Transparência do espelho (P4 da auditoria «site comprometido»): lista os domínios externos para
 * onde o HTML espelhado liga (links, formulários, iframes) e que NÃO são a oferta, o site de origem,
 * um checkout conhecido nem um domínio comum e inofensivo (vídeo, mapas, redes sociais, .gov/.edu).
 *
 * Só leitura/diagnóstico: não altera o HTML servido (sem cloaking).
 */

const BENIGN_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "google.com",
  "gstatic.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "wikipedia.org",
  "nih.gov",
  "fda.gov",
  "ftc.gov",
  "clickora.com",
  "dclickora.com",
];

const SUPPORT_HOST_SUFFIXES = [
  "zendesk.com",
  "freshdesk.com",
  "helpscout.net",
  "intercom.help",
  "clkbank.com",
  "tawk.to",
];

const OPTOUT_TEXT_RE =
  /\b(unsubscribe|opt[\s-]?out|manage\s+(?:email\s+)?preferences|email\s+preferences|stop\s+receiving|remove\s+(?:me\s+)?from\s+(?:this\s+)?list|cancelar\s+subscri[cç][aã]o|descadastrar)\b/i;

const OPTOUT_URL_RE =
  /(?:\/o-[a-z0-9]{2,}-[a-z0-9]{2,}-[0-9a-f]{12,}(?:[/?#]|$)|(?:^|[/?&._-])(unsubscribe|opt[-_]?out|list[-_]?unsubscribe|email[-_]?preferences)(?:$|[/?=&#._-]))/i;

const LEGAL_OR_SUPPORT_RE =
  /\b(privacy|terms|contact|contacto|contato|support|suporte|help|disclaimer|return(?:s)?|refund|shipping|references|cookie(?:s)?|faq|about|privacidade|termos|politica|aviso)\b/i;

const OPEN_REDIRECT_PARAM_RE =
  /[?&](redirect|url|next|return|dest|destination|continue|redir|go|out)=https?:\/\//i;

function stripWww(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isBenignMirrorHost(host: string): boolean {
  const clean = stripWww(host);
  if (BENIGN_HOST_SUFFIXES.some((d) => hostMatches(clean, d))) return true;
  return /\.(gov|edu)(\.[a-z]{2})?$/.test(clean);
}

export function isOptOutOrUnsubscribeAnchor(args: {
  href: string;
  label?: string;
  ariaLabel?: string;
  title?: string;
}): boolean {
  const combinedLabel = `${args.label || ""} ${args.ariaLabel || ""} ${args.title || ""}`
    .replace(/\s+/g, " ")
    .trim();
  if (combinedLabel && OPTOUT_TEXT_RE.test(combinedLabel)) return true;
  const href = (args.href || "").trim();
  if (!href) return false;
  return OPTOUT_URL_RE.test(href);
}

export function hasUntrustedOpenRedirectQuery(
  abs: URL,
  trustedHosts: Set<string>,
): boolean {
  const raw = `${abs.pathname}${abs.search}`;
  if (!OPEN_REDIRECT_PARAM_RE.test(raw)) return false;
  const host = stripWww(abs.hostname);
  if ([...trustedHosts].some((t) => hostMatches(host, t))) return false;
  if (hostLooksLikeCommerceOrCheckout(host)) return false;
  for (const param of ["redirect", "url", "next", "return", "dest", "destination", "continue", "redir", "go", "out"]) {
    const val = abs.searchParams.get(param);
    if (!val || !/^https?:\/\//i.test(val.trim())) continue;
    try {
      const inner = new URL(val.trim());
      const ih = stripWww(inner.hostname);
      if ([...trustedHosts].some((t) => hostMatches(ih, t))) continue;
      if (hostLooksLikeCommerceOrCheckout(ih) || isBenignMirrorHost(ih)) continue;
      return true;
    } catch {
      return true;
    }
  }
  return false;
}

export function isAuthorizedLegalOrSupportAnchor(args: {
  abs: URL;
  label?: string;
  trustedHosts?: Set<string>;
}): boolean {
  const { abs } = args;
  if (abs.protocol !== "https:" && abs.protocol !== "http:") return false;
  if (isOptOutOrUnsubscribeAnchor({ href: abs.href, label: args.label })) return false;
  const trusted = args.trustedHosts ?? new Set<string>();
  if (hasUntrustedOpenRedirectQuery(abs, trusted)) return false;
  const host = stripWww(abs.hostname);
  if (SUPPORT_HOST_SUFFIXES.some((d) => hostMatches(host, d))) return true;
  const labelAndPath = `${args.label || ""} ${abs.pathname}`.replace(/\s+/g, " ").trim();
  return LEGAL_OR_SUPPORT_RE.test(labelAndPath);
}

function removeAnchorCleanly(el: HTMLElement): void {
  const parent = el.parentNode as HTMLElement | null;
  el.remove();
  if (parent && parent.tagName?.toLowerCase() === "li") {
    const remainingText = (parent.textContent || "").replace(/\s+/g, "").trim();
    const hasInteractiveOrMedia = parent.querySelector("a, button, img, svg, input") !== null;
    if (!remainingText && !hasInteractiveOrMedia) {
      parent.remove();
    }
  }
}

export function sanitizeMirrorUntrustedAnchors(
  root: HTMLElement,
  opts: {
    base?: URL | null;
    trustedHosts?: Iterable<string | null | undefined>;
    stripUnknownExternal?: boolean;
  } = {},
): void {
  const trusted = new Set<string>();
  for (const h of opts.trustedHosts ?? []) {
    if (h && h.trim()) trusted.add(stripWww(h.trim()));
  }

  for (const node of root.querySelectorAll("a, area")) {
    const el = node as HTMLElement;
    const href = (el.getAttribute("href") || "").trim();
    const label = (el.textContent || "").replace(/\s+/g, " ").trim();
    const ariaLabel = el.getAttribute("aria-label") || "";
    const title = el.getAttribute("title") || "";

    if (isOptOutOrUnsubscribeAnchor({ href, label, ariaLabel, title })) {
      removeAnchorCleanly(el);
      continue;
    }

    if (!href) continue;
    if (href.startsWith("#") || /^(mailto|tel):/i.test(href)) continue;
    if (href.startsWith(CLICKORA_MIRROR_TRACK_MARKER) || /\/track\/r\//i.test(href)) continue;

    if (/^(javascript|vbscript|data):/i.test(href)) {
      el.removeAttribute("href");
      if (!label) removeAnchorCleanly(el);
      continue;
    }

    const candidate = href.startsWith("//") ? `https:${href}` : href;
    if (!/^https?:\/\//i.test(candidate)) continue; // relativos legitimamente tratados pelo host atual

    let abs: URL;
    try {
      abs = opts.base ? new URL(candidate, opts.base) : new URL(candidate);
    } catch {
      continue;
    }

    const host = stripWww(abs.hostname);
    if (!host || host === "clickora.invalid") continue;

    const isTrusted = [...trusted].some((t) => hostMatches(host, t));
    const isCommerce = hostLooksLikeCommerceOrCheckout(host);
    const isBenign = isBenignMirrorHost(host);

    if (hasUntrustedOpenRedirectQuery(abs, trusted) && !isTrusted && !isCommerce) {
      removeAnchorCleanly(el);
      continue;
    }

    if (!opts.stripUnknownExternal) continue;
    if (isTrusted || isCommerce || isBenign) continue;
    if (isAuthorizedLegalOrSupportAnchor({ abs, label: `${label} ${ariaLabel} ${title}`, trustedHosts: trusted })) {
      continue;
    }

    // Link externo desconhecido (não é oferta, origem, legal, suporte nem referência): neutralizar saída.
    if (el.tagName?.toLowerCase() === "area" || !label) {
      removeAnchorCleanly(el);
    } else {
      el.replaceWith(el.innerHTML || label);
    }
  }
}

export type MirrorExternalHostsReport = {
  /** Domínios externos não reconhecidos (ordenados, sem duplicados, máx. 25). */
  hosts: string[];
  /** Quantas ligações/elementos apontam para esses domínios. */
  count: number;
};

export function listUntrustedMirrorExternalHosts(
  html: string,
  trustedHosts: Iterable<string | null | undefined>,
): MirrorExternalHostsReport {
  const empty: MirrorExternalHostsReport = { hosts: [], count: 0 };
  if (!html || html.length < 20) return empty;

  const trusted = new Set<string>();
  for (const h of trustedHosts) {
    if (h && h.trim()) trusted.add(stripWww(h.trim()));
  }

  let root;
  try {
    root = parse(html, { comment: false });
  } catch {
    return empty;
  }

  const urls: string[] = [];
  root.querySelectorAll("a[href], area[href]").forEach((el) => {
    const v = el.getAttribute("href");
    if (v) urls.push(v);
  });
  root.querySelectorAll("form[action]").forEach((el) => {
    const v = el.getAttribute("action");
    if (v) urls.push(v);
  });
  root.querySelectorAll("[formaction]").forEach((el) => {
    const v = el.getAttribute("formaction");
    if (v) urls.push(v);
  });
  root.querySelectorAll("iframe[src]").forEach((el) => {
    const v = el.getAttribute("src");
    if (v) urls.push(v);
  });

  const found = new Map<string, number>();
  for (const raw of urls) {
    const v = raw.trim();
    if (!v || v.startsWith("#")) continue;
    const candidate = v.startsWith("//") ? `https:${v}` : v;
    if (!/^https?:\/\//i.test(candidate)) continue; // relativos, mailto:, tel:, javascript:, data:
    if (candidate.startsWith(CLICKORA_MIRROR_TRACK_MARKER)) continue;
    let u: URL;
    try {
      u = new URL(candidate);
    } catch {
      continue;
    }
    const host = stripWww(u.hostname);
    if (!host || host === "clickora.invalid") continue;
    if ([...trusted].some((t) => hostMatches(host, t))) continue;
    if (hostLooksLikeCommerceOrCheckout(host)) continue;
    if (isBenignMirrorHost(host)) continue;
    found.set(host, (found.get(host) || 0) + 1);
  }

  const hosts = [...found.keys()].sort().slice(0, 25);
  let count = 0;
  for (const n of found.values()) count += n;
  return { hosts, count };
}

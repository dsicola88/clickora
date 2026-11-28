import { CLICKORA_MIRROR_TRACK_MARKER } from "@/lib/presellMirrorMarkers";
import { isCommerceHashHref } from "@/lib/presellCommerceHash";

const COMMERCE_HOST_MARKERS = [
  "buygoods",
  "clickbank.net",
  "clickbank.com",
  "digistore",
  "checkout-ds24",
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
  "mwebinsight.com",
  "mwebdatawatch.com",
  "mwebkivo.com",
  "maxweb",
  "bestbuyhere",
  "hop.clickbank",
  "monetizze",
  "braip",
  "eduzz",
  "smartadv",
  "adcombo",
  "everflow",
  "leadbit",
  "dr.cash",
  "drcash",
  "maxbounty",
];

const CTA_LABEL =
  /order\s*now|buy\s*now|add to cart|shop now|checkout|get started|get\s+[\w\s]{0,48}official|go directly|official site|official shop|official website|comprar agora|ver oferta|continuar|add to bag|claim\s+offer|secure\s+order|add\s+to\s+cart|starter package|best value|most popular|money[\s-]?back|get\s+your|try\s+now|learn more at|visit\s+(the\s+)?official/i;

const BUTTONISH_CLASS =
  /\b(btn|button|cta|elementor-button|wp-block-button|shop-button|buy-button|offer-button|add-to-cart|anchor_to_product)\b/i;

const SOFT_NAV =
  /privacy|terms|cookie|contacto|contact|about|faq|login|signin|sign-in|account|policy|disclaimer|shipping|returns|refund|support|suporte|references|#(top|content|main|inicio|topo|footer|nav)\b/i;

/** Labels de rodapé/legal — nunca devem ir para `/track/r/` (mesmo se o import marcou o marcador). */
const SOFT_NAV_LABEL =
  /^(contact|contacto|terms(\s+of\s+(service|use))?|privacy(\s+policy)?|return(\s+policy)?|returns|refund(\s+policy)?|disclaimer|shipping(\s+policy)?|cookie(\s+policy)?|about(\s+us)?|faq|support|references)$/i;

const OPTOUT_TEXT_RE =
  /\b(unsubscribe|opt[\s-]?out|manage\s+(?:email\s+)?preferences|email\s+preferences|stop\s+receiving|remove\s+(?:me\s+)?from\s+(?:this\s+)?list|cancelar\s+subscri[cç][aã]o|descadastrar)\b/i;

const OPTOUT_URL_RE =
  /(?:\/o-[a-z0-9]{2,}-[a-z0-9]{2,}-[0-9a-f]{12,}(?:[/?#]|$)|(?:^|[/?&._-])(unsubscribe|opt[-_]?out|list[-_]?unsubscribe|email[-_]?preferences)(?:$|[/?=&#._-]))/i;

const OPEN_REDIRECT_PARAM_RE =
  /[?&](redirect|url|next|return|dest|destination|continue|redir|go|out)=https?:\/\//i;

function isOptOutOrUnsafeExternalAnchor(attrs: string, inner: string, affiliateHref: string): boolean {
  const href = htmlTagAttr(attrs, "href");
  const aria = htmlTagAttr(attrs, "aria-label");
  const title = htmlTagAttr(attrs, "title");
  const text = `${plainInnerText(inner)} ${aria} ${title}`.replace(/\s+/g, " ").trim();
  if (text && OPTOUT_TEXT_RE.test(text)) return true;
  if (href && OPTOUT_URL_RE.test(href)) return true;
  if (href && OPEN_REDIRECT_PARAM_RE.test(href) && !hrefLooksLikeOfferLink(href, affiliateHref)) {
    return true;
  }
  return false;
}

const CHECKOUT_PATH =
  /(\/secure\/checkout|\/checkout\.html|\/checkout\/|\/checkout\?|\/cart\/|\/cart\?|\/order\/|\/buy\b|\/purchase|\/pay\b|aff_id=|affiliate[_-]?id=|vendor[_-]?id=|cbfid=|cbexit|cbtimer|tid=|item[_-]?number=)/i;

function hostnameNoWww(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Href de checkout / afiliado / CTA comercial — deve ir para `/track/r/`. */
export function hrefLooksLikeOfferLink(rawHref: string, affiliateHref = ""): boolean {
  const href = (rawHref || "").trim();
  if (!href || href === "#" || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) {
    return false;
  }
  if (href === CLICKORA_MIRROR_TRACK_MARKER) return true;
  try {
    const abs = new URL(href, "https://example.invalid/");
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return false;
    const path = abs.pathname.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|svg|ico|mp4|webm|pdf|zip|css|js|mjs|map|woff2?|ttf|otf|eot)(\?|$)/.test(path)) {
      return false;
    }
    const h = abs.hostname.replace(/^www\./, "").toLowerCase();
    if (COMMERCE_HOST_MARKERS.some((m) => h.includes(m))) return true;
    if (CHECKOUT_PATH.test(`${abs.pathname}${abs.search}`)) return true;
    const affHost = hostnameNoWww(affiliateHref);
    if (affHost && h === affHost) return true;
    return false;
  } catch {
    return false;
  }
}

/** Texto de CTA comercial (exposto para o interceptor de cliques). */
export function isCtaLabel(text: string): boolean {
  return CTA_LABEL.test(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function plainInnerText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function isSoftNavLabel(text: string): boolean {
  return SOFT_NAV_LABEL.test(plainInnerText(text));
}

function isSoftNavHref(href: string): boolean {
  const h = (href || "").trim();
  if (!h) return false;
  if (/^(mailto|tel|javascript|data):/i.test(h)) return true;
  return SOFT_NAV.test(h);
}

function isTrackOrMarkerHref(href: string): boolean {
  const h = (href || "").trim();
  return (
    h === CLICKORA_MIRROR_TRACK_MARKER ||
    /\/track\/r\//i.test(h) ||
    /clickora\.invalid\/__TRACK/i.test(h)
  );
}

/** `<base href>` do merchant faz CTAs relativos e assets resolverem no lander — neutralizar. */
export function neutralizeMirrorBaseHref(html: string): string {
  return html.replace(/<base\b[^>]*>/gi, '<base href="./">');
}

function hasButtonishClass(attrs: string): boolean {
  const cls = attrs.match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
  return BUTTONISH_CLASS.test(cls);
}

function upsertAttr(attrs: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, "i");
  if (re.test(attrs)) return attrs.replace(re, ` ${name}="${value}"`);
  return `${attrs} ${name}="${value}"`;
}

/**
 * Reescreve âncoras/CTAs do HTML do espelho para o hoplink rastreado.
 * Cobre marcador, buygoods/digistore/checkout, CTAs com texto de compra
 * (mesmo com URL do produto) e âncoras com classe de botão.
 */
export function bakeHtmlOfferHrefs(code: string, trackHref: string, affiliateHref = ""): string {
  const track = trackHref.trim();
  if (!track || !code) return code;

  let out = neutralizeMirrorBaseHref(code.split(CLICKORA_MIRROR_TRACK_MARKER).join(track));

  // Remove chrome PT acidental no topo (skip-links / “voltar ao topo”) em páginas EN.
  out = out.replace(
    /<a\b[^>]*>\s*(?:Topo da p[aá]gina|Voltar ao topo|Pular para o conte[uú]do|Ir para o conte[uú]do|Skip to (?:content|main))\s*<\/a>/gi,
    "",
  );

  out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    if (isOptOutOrUnsafeExternalAnchor(attrs, inner, affiliateHref)) return "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
    const href = (hrefMatch?.[2] || "").trim();
    const labelHit = isCtaLabel(inner);
    const softLabel = isSoftNavLabel(inner);
    const offerHit = hrefLooksLikeOfferLink(href, affiliateHref);
    const hashOrder = isCommerceHashHref(href);
    const buttonish = hasButtonishClass(attrs);
    const soft = isSoftNavHref(href);
    if (innerLooksLikeNetworkBadge(inner) && !labelHit) return "";

    /** Contact / Privacy / Terms nunca abrem a oferta — mesmo com marcador errado no import. */
    if (softLabel && !labelHit) {
      if (isTrackOrMarkerHref(href) || offerHit || hashOrder) {
        let next = upsertAttr(attrs, "href", "#");
        next = next.replace(/\sdata-clickora-offer\s*=\s*(["'])[\s\S]*?\1/gi, "");
        next = next.replace(/\starget\s*=\s*(["'])[\s\S]*?\1/gi, "");
        return `<a${next}>${inner}</a>`;
      }
      return full;
    }

    // Soft-nav (privacy, #top…) só se não for CTA/comercial.
    if (soft && !labelHit && !offerHit && !hashOrder) return full;
    // #order-now / CTAs comerciais / botões — hoplink rastreado na janela principal.
    if (!hashOrder && !offerHit && !labelHit && !(buttonish && !soft)) return full;

    let next = upsertAttr(attrs, "href", track);
    next = upsertAttr(next, "data-clickora-offer", "1");
    /** `_top`: navegação nativa sai do sandbox do iframe sem depender só do JS. */
    next = upsertAttr(next, "target", "_top");
    next = upsertAttr(next, "rel", "noopener noreferrer");
    return `<a${next}>${inner}</a>`;
  });

  // formaction / action em forms de checkout
  out = out.replace(/\b(formaction|action)\s*=\s*(["'])([^"']+)\2/gi, (full, attr, q, href) => {
    if (!hrefLooksLikeOfferLink(href, affiliateHref)) return full;
    return `${attr}=${q}${track}${q}`;
  });
  /** Forms cujo `action` aponta ao hop rastreado submetem na janela principal (sem JS no iframe). */
  out = out.replace(/<form\b([^>]*)>/gi, (full, attrs: string) => {
    if (htmlTagAttr(attrs, "action") !== track) return full;
    return `<form${upsertAttr(attrs, "target", "_top")}>`;
  });

  /** Segunda passagem: ofertas cruas que escaparam (classe/atributos atípicos no espelho). */
  out = out.replace(/<a\b([^>]*)\bhref\s*=\s*(["'])([\s\S]*?)\2/gi, (full, attrs: string, _q: string, href: string) => {
    const h = (href || "").trim();
    if (!h || isTrackOrMarkerHref(h) || isSoftNavHref(h)) return full;
    if (!hrefLooksLikeOfferLink(h, affiliateHref)) return full;
    const innerMatch = full.match(/>([\s\S]*?)<\/a>/i);
    const inner = innerMatch?.[1] || "";
    if (isSoftNavLabel(inner) && !isCtaLabel(inner)) return full;
    let next = upsertAttr(attrs, "href", track);
    next = upsertAttr(next, "data-clickora-offer", "1");
    next = upsertAttr(next, "target", "_top");
    next = upsertAttr(next, "rel", "noopener noreferrer");
    return `<a${next}>${inner}</a>`;
  });

  // `<button>` de compra (ex. Get Started / anchor_to_product) — âncora com hoplink rastreado.
  out = out.replace(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, (full, attrs: string, inner: string) => {
    const type = (htmlTagAttr(attrs, "type") || "submit").toLowerCase();
    if (type === "reset") return full;
    if (isSoftNavLabel(inner)) return full;
    const labelHit = isCtaLabel(inner);
    const buttonish = hasButtonishClass(attrs) || /\bdata-eltype\s*=\s*(["'])button\1/i.test(attrs);
    if (!labelHit && !buttonish) return full;
    let next = ` ${attrs}`.replace(/\s+type\s*=\s*(["'])[\s\S]*?\1/i, "");
    next = upsertAttr(next, "href", track);
    next = upsertAttr(next, "data-clickora-offer", "1");
    next = upsertAttr(next, "target", "_top");
    next = upsertAttr(next, "rel", "noopener noreferrer");
    return `<a${next}>${inner}</a>`;
  });

  // Remove <li> vazios criados após remoção de opt-out / skip-links.
  out = out.replace(/<li\b[^>]*>\s*<\/li>/gi, "");

  return stripNetworkFooterChrome(out);
}

const NETWORK_FOOTER_BRAND =
  /buygoods|clickbank|digistore|hotmart|jvzoo|warriorplus|cartpanda|paylix|bestbuyhere/i;

function htmlTagAttr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return (m?.[1] || m?.[2] || m?.[3] || "").trim();
}

function innerLooksLikeNetworkBadge(html: string): boolean {
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return NETWORK_FOOTER_BRAND.test(t) && t.length < 48;
}

/** Tira o logo “powered by buygoods” do rodapé; não mexe em CTAs já rastreados. */
function stripNetworkFooterChrome(html: string): string {
  let out = html.replace(/<img\b[^>]*>/gi, (full) => {
    if (NETWORK_FOOTER_BRAND.test(full)) return "";
    return full;
  });
  out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text && /\bdata-clickora-offer\s*=/i.test(attrs) && !/\/track\/r\//i.test(attrs)) {
      return "";
    }
    if (innerLooksLikeNetworkBadge(inner) || NETWORK_FOOTER_BRAND.test(htmlTagAttr(attrs, "href"))) {
      if (isCtaLabel(inner)) return full;
      return "";
    }
    return full;
  });
  return out;
}

/**
 * Hoplinks de tracking (Everflow / Knownwalk / SmartAdv, etc.).
 * O CTA da venda aponta para o hop; o import resolve o redirect (browser) até à sales page
 * — igual a BuyGoods/MaxWeb — em vez de espelhar o short-link.
 */
import http from "node:http";
import {
  IMPORT_MAX_HTML_BYTES,
  PresellImportBlockedError,
  assertExternalProductUrl,
  vetImportUrl,
} from "./presellImportSsrf";
import { nodeImportRequest } from "./presellSafeFetch";

/** Hosts que só fazem hop/track — resposta tipicamente JSON, 302 ou interstitial. */
const AFFILIATE_HOP_ONLY_HOSTS = [
  "knownwalk.com",
  // Espelhos / CDN Everflow usados como short-link de oferta
  "trk.knownwalk.com",
] as const;

/**
 * Path Everflow clássico: /2MSQQZ2M/22JQ9DB7/ (dois segmentos opacos).
 * Não confundir com /product/slug de lojas.
 */
const EVERFLOW_STYLE_HOP_PATH =
  /^\/[A-Za-z0-9]{4,32}\/[A-Za-z0-9]{4,32}\/?$/;

function hostnameNoWww(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isAffiliateHopOnlyHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  if (!h) return false;
  return AFFILIATE_HOP_ONLY_HOSTS.some((m) => h === m || h.endsWith(`.${m}`));
}

/**
 * True quando o URL é um hoplink de rede (Knownwalk/Everflow) e **não** uma página de produto.
 * Ex.: https://www.knownwalk.com/2MSQQZ2M/22JQ9DB7/
 */
export function looksLikeAffiliateHopOnlyUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (isAffiliateHopOnlyHost(host)) return true;
    // Path Everflow em host desconhecido: só se parecer short-link (sem path “humano”)
    if (EVERFLOW_STYLE_HOP_PATH.test(u.pathname) && /knownwalk|everflow|eflow/i.test(host)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Resposta típica de hop Everflow (JSON) ou challenge Cloudflare — não é HTML de oferta. */
export function looksLikeNonProductImportBody(body: string, contentType?: string | null): boolean {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("application/json") || ct.includes("+json")) return true;
  const sample = body.slice(0, 8_000).toLowerCase();
  if (/^\s*[{[]/.test(body.trim()) && /"(transaction_id|offer_id|click_id|everflow)"/i.test(body)) {
    return true;
  }
  if (
    /checking the site|just a moment|attention required|cf-browser-verification|cdn-cgi\/challenge|enable javascript and cookies to continue|ray id:|520:\s*web server is returning|error code:\s*520/i.test(
      sample,
    )
  ) {
    return true;
  }
  return false;
}

/** Quando o hop Knownwalk/SmartAdv não resolveu para sales page (CF/timeout). */
export function affiliateHopResolveFailedMessage(): string {
  return (
    "Não foi possível abrir a sales page a partir deste hoplink Knownwalk/SmartAdv (redirect ou Cloudflare). " +
    "Cole o mesmo hoplink em «Hoplink da rede» e a sales page pública em «Página do produto» (ex.: https://melaramax.com/)."
  );
}

export function hostnameFromUrl(url: string): string {
  return hostnameNoWww(url);
}

function headerValue(headers: http.IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

/** Brand legível a partir do host da sales page (melaramax.com → Melaramax). */
export function brandFromSalesHostname(hostname: string): string {
  const base = hostname.replace(/^www\./i, "").split(".")[0] || "";
  if (!base) return "Product";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Origem limpa da sales page (sem query Everflow). */
export function salesOriginFromHopDestination(destUrl: string): string | null {
  try {
    const u = new URL(destUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.origin}/`;
  } catch {
    return null;
  }
}

/**
 * Lê só o 302 Location do hop (sem seguir até ao Cloudflare).
 * Ex.: knownwalk → https://melaramax.com/?everflow=…
 */
export async function peekAffiliateHopRedirectUrl(hopUrl: string): Promise<string | null> {
  assertExternalProductUrl(hopUrl);
  try {
    const vetted = await vetImportUrl(hopUrl);
    const exchange = await nodeImportRequest({
      url: vetted.url,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/json",
      },
      addresses: vetted.addresses,
      signal: AbortSignal.timeout(10_000),
      maxBytes: Math.min(IMPORT_MAX_HTML_BYTES, 64_000),
    });
    if (exchange.status >= 300 && exchange.status < 400) {
      const loc = headerValue(exchange.headers, "location");
      if (loc) return new URL(loc, vetted.url).href;
    }
    const body = exchange.body.toString("utf8");
    const href = body.match(/href=["'](https?:[^"']+)["']/i)?.[1];
    if (href) return href.replace(/&amp;/g, "&");
    return null;
  } catch (e) {
    if (e instanceof PresellImportBlockedError) return null;
    return null;
  }
}

/** HTML mínimo para extract de nome quando CF bloqueia o corpo da sales page. */
export function stubHtmlForHopResolvedBrand(brand: string, salesUrl: string): string {
  const safe = brand.replace(/[<>&]/g, "").slice(0, 80) || "Product";
  const safeUrl = salesUrl.replace(/"/g, "");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safe}</title><meta property="og:title" content="${safe}"><meta property="og:url" content="${safeUrl}"></head><body><h1>${safe}</h1><p>${safe} product overview for affiliates.</p><a href="${safeUrl}">Buy Now</a></body></html>`;
}

import type { Request } from "express";
import { isMainOrPreviewHostname } from "./presellHostAccess";
import { getRequestHostname } from "./requestHost";
import { getPublicPresellHost, getPublicPresellOrigin, isPlatformMainHostname } from "./publicPresellHost";
import { getVerifiedOwnerIdForHostname } from "./customDomainCache";

export function isPresellUuidParam(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/** Hosts de infra (API Railway, localhost): nunca são o domínio público de uma presell. */
function isInfraHostname(h: string): boolean {
  return (
    h.endsWith(".railway.app") ||
    h.endsWith(".railway.dev") ||
    h.endsWith(".run.app") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

/**
 * Origens vindas do pedido (`spa_origin`, `X-Forwarded-Host`, `Referer`) só servem de destino de
 * redirect se o host for nosso: dev local, preview Vercel, plataforma, domínio técnico de presells
 * ou domínio personalizado verificado. Evita open redirect (`?spa_origin=https://outro-site`).
 */
function isTrustedRedirectHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.+$/, "");
  if (!h) return false;
  if (isMainOrPreviewHostname(h) || isPlatformMainHostname(h)) return true;
  const technical = getPublicPresellHost();
  if (technical && technical.toLowerCase() === h) return true;
  return getVerifiedOwnerIdForHostname(h) !== null;
}

function trustedOriginOrNull(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return isTrustedRedirectHostname(u.hostname) ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * Origem da SPA (Vite/Vercel) para redirects a partir da API.
 * Evita 302 `/p/:id` cair no host da API (:3001 / Railway) quando o HTML lite
 * é pedido directo ao backend (dev ou LitePresellEntry).
 */
export function resolvePublicAppOrigin(req: Request): string | null {
  const env =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim().split(",")[0]?.trim() ||
    process.env.APP_PUBLIC_URL?.trim();
  if (env) {
    try {
      const u = new URL(env.includes("://") ? env : `https://${env}`);
      return u.origin;
    } catch {
      /* fall through */
    }
  }

  const q = typeof req.query.spa_origin === "string" ? req.query.spa_origin.trim() : "";
  if (q) {
    const trusted = trustedOriginOrNull(q);
    if (trusted) return trusted;
  }

  const xfHost = (req.get("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = xfHost || (req.get("host") || "").trim();
  const hostOnly = host.split(":")[0]?.toLowerCase() || "";
  const isApiHost =
    hostOnly.includes("railway.app") ||
    hostOnly === "localhost" && host.includes("3001") ||
    host.endsWith(":3001") ||
    host.endsWith(":3011");

  if (xfHost && !isApiHost) {
    const proto = (req.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
    const trusted = trustedOriginOrNull(`${proto}://${xfHost}`);
    if (trusted) return trusted;
  }

  const ref = req.get("referer") || req.get("referrer") || "";
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.port !== "3001" && u.port !== "3011" && !u.hostname.includes("railway.app")) {
        const trusted = trustedOriginOrNull(u.origin);
        if (trusted) return trusted;
      }
    } catch {
      /* ignore */
    }
  }

  // Pedido same-host (rewrite Vercel /l → html): origem relativa OK
  if (!isApiHost && host) {
    const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0]?.trim() || "http";
    return trustedOriginOrNull(`${proto}://${host}`);
  }

  return null;
}

function hostnameOfOrigin(origin: string | null): string {
  if (!origin) return "";
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * URL pública da presell a partir da API (`/l/:id` lite-inelegível → SPA).
 *
 * - Domínio personalizado do assinante (host do visitante ≠ plataforma/preview/infra):
 *   caminho RELATIVO no mesmo host — `/{slug}` (ou `/p/:id` sem slug).
 * - Domínio técnico (`PUBLIC_PRESELL_HOST`): sempre `/p/:id` relativo (sem dono verificado, sem slug).
 * - Domínio principal da plataforma (`dclickora.com` / `www`), ou origem que resolve para ele:
 *   NUNCA gera URL pública ali (o SaaS não hospeda presells). Usa o domínio técnico isolado
 *   `PUBLIC_PRESELL_HOST` (`https://<host>/p/:id`) e, sem ele, devolve `null` — o chamador deve
 *   avisar que é preciso conectar um domínio próprio.
 * - Dev (localhost) / preview Vercel: `/p/:id` na origem da SPA, como antes.
 *
 * O host do visitante vem de `getRequestHostname` (atrás do rewrite Vercel → Railway o `Host`
 * é o da API).
 */
export function publicSpaPresellUrl(
  req: Request,
  presellId: string,
  slug?: string | null,
): string | null {
  const visitorHost = (getRequestHostname(req) ?? "").toLowerCase();
  const s = typeof slug === "string" ? slug.trim() : "";
  const onTenantHost =
    visitorHost.length > 0 && !isMainOrPreviewHostname(visitorHost) && !isInfraHostname(visitorHost);

  // Domínio técnico não é domínio verificado de assinante: `/{slug}` daria 404 (getPublicBySlug).
  if (onTenantHost && visitorHost === getPublicPresellHost()) {
    return `/p/${presellId}`;
  }
  if (onTenantHost) {
    return s.length > 0 && !isPresellUuidParam(s) ? `/${encodeURIComponent(s)}` : `/p/${presellId}`;
  }

  const origin = resolvePublicAppOrigin(req);
  if (isPlatformMainHostname(visitorHost) || isPlatformMainHostname(hostnameOfOrigin(origin))) {
    const technical = getPublicPresellOrigin();
    return technical ? `${technical}/p/${presellId}` : null;
  }
  const path = `/p/${presellId}`;
  return origin ? `${origin}${path}` : path;
}

/** Parâmetros internos do pedido à API — não pertencem à URL do visitante. */
const INTERNAL_LANDING_QUERY_KEYS = ["visitor_host", "spa_origin"];

/**
 * Anexa a query original da chegada (gclid, wbraid, gad_source, UTMs…) a um URL da SPA,
 * sem os parâmetros internos.
 */
export function withLandingQuery(url: string, req: Pick<Request, "originalUrl" | "url">): string {
  const raw = req.originalUrl || req.url || "";
  const qIdx = raw.indexOf("?");
  if (qIdx < 0) return url;
  const params = new URLSearchParams(raw.slice(qIdx + 1));
  for (const k of INTERNAL_LANDING_QUERY_KEYS) params.delete(k);
  const qs = params.toString();
  if (!qs) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${qs}`;
}

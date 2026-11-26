import type { Request } from "express";
import { isMainOrPreviewHostname } from "./presellHostAccess";
import { getRequestHostname } from "./requestHost";

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
    try {
      const u = new URL(q);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      /* ignore */
    }
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
    return `${proto}://${xfHost}`;
  }

  const ref = req.get("referer") || req.get("referrer") || "";
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.port !== "3001" && u.port !== "3011" && !u.hostname.includes("railway.app")) {
        return u.origin;
      }
    } catch {
      /* ignore */
    }
  }

  // Pedido same-host (rewrite Vercel /l → html): origem relativa OK
  if (!isApiHost && host) {
    const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0]?.trim() || "http";
    return `${proto}://${host}`;
  }

  return null;
}

/**
 * URL para a SPA pública a partir da API (`/l/:id` lite-inelegível → SPA).
 *
 * - Domínio personalizado do assinante (host do visitante ≠ site principal/preview/infra):
 *   caminho RELATIVO no mesmo host — `/{slug}` (ou `/p/:id` sem slug). Nunca salta para o
 *   dclickora.com, e o slug só é usado onde existe (é único por utilizador, não global).
 * - Site principal / preview / dev: `/p/:id` (existe em todos os hosts → 200) na origem da SPA.
 *
 * O host do visitante vem de `getRequestHostname` (atrás do rewrite Vercel → Railway o `Host`
 * é o da API, o que antes fazia o slug cair no host errado → 404).
 */
export function publicSpaPresellUrl(
  req: Request,
  presellId: string,
  slug?: string | null,
): string {
  const visitorHost = (getRequestHostname(req) ?? "").toLowerCase();
  const s = typeof slug === "string" ? slug.trim() : "";
  const onTenantHost =
    visitorHost.length > 0 && !isMainOrPreviewHostname(visitorHost) && !isInfraHostname(visitorHost);

  if (onTenantHost) {
    return s.length > 0 && !isPresellUuidParam(s) ? `/${encodeURIComponent(s)}` : `/p/${presellId}`;
  }
  const origin = resolvePublicAppOrigin(req);
  const path = `/p/${presellId}`;
  return origin ? `${origin}${path}` : path;
}

import type { Request } from "express";

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

/** URL absoluta ou relativa para a SPA pública `/p/:id`. */
export function publicSpaPresellUrl(req: Request, presellId: string): string {
  const path = `/p/${presellId}`;
  const origin = resolvePublicAppOrigin(req);
  return origin ? `${origin}${path}` : path;
}

import type { Request } from "express";
import { systemPrisma } from "./prisma";
import { getRequestHostname } from "./requestHost";

function inferHttpsForPublicHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0] ?? "";
  if (h === "localhost" || h === "127.0.0.1") return false;
  if (h.endsWith(".dclickora.com") || h === "dclickora.com") return true;
  if (h.endsWith(".up.railway.app") || h.endsWith(".railway.app")) return true;
  if (h.endsWith(".vercel.app")) return true;
  return false;
}

/** Base pública da API (com sufixo `/api`), para URLs em scripts e postbacks. */
export function publicApiBaseFromRequest(req: Request): string {
  const env = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.get("x-forwarded-host") || req.get("host") || `localhost:${process.env.PORT || 3001}`;
  let proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0]?.trim() || "http";
  if (proto === "http" && inferHttpsForPublicHost(host)) {
    proto = "https";
  }
  return `${proto}://${host}/api`;
}

/**
 * Hostname preferido para /api/track da conta (sem fallback de request).
 * Ordem: is_default_tracking → purpose=tracking → qualquer both/tracking verificado.
 */
export async function preferredTrackApiBaseForUser(userId: string): Promise<string | null> {
  try {
    const preferred =
      (await systemPrisma.customDomain.findFirst({
        where: {
          userId,
          status: "verified",
          isDefaultTracking: true,
          OR: [{ purpose: "tracking" }, { purpose: "both" }],
        },
        select: { hostname: true },
      })) ??
      (await systemPrisma.customDomain.findFirst({
        where: { userId, status: "verified", purpose: "tracking" },
        orderBy: { createdAt: "asc" },
        select: { hostname: true },
      })) ??
      (await systemPrisma.customDomain.findFirst({
        where: { userId, status: "verified", purpose: "both" },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { hostname: true },
      }));
    if (!preferred?.hostname) return null;
    return `https://${preferred.hostname}/api`;
  } catch {
    return null;
  }
}

/**
 * Preferência de domínio de tracking da conta (purpose tracking/both + is_default_tracking).
 * Fallback: `publicApiBaseFromRequest`.
 */
export async function trackApiBaseForUser(req: Request, userId: string): Promise<string> {
  const preferred = await preferredTrackApiBaseForUser(userId);
  return preferred ?? publicApiBaseFromRequest(req);
}

/** Domínio principal do SaaS: o edge devolve 404 em `/api/track/r|rot` (isolamento de anúncios). */
export function isPlatformMainApiBase(base: string): boolean {
  try {
    const h = new URL(base).hostname.toLowerCase();
    return h === "dclickora.com" || h === "www.dclickora.com";
  } catch {
    return false;
  }
}

/**
 * Base de `/api/track` que funciona em links públicos (rotadores, redirects).
 * Domínio da conta; senão o fallback do pedido, excepto se for o domínio principal (bloqueado no edge).
 * `null` = a conta precisa de um domínio verificado.
 */
export async function usableTrackApiBaseForUser(req: Request, userId: string): Promise<string | null> {
  const preferred = await preferredTrackApiBaseForUser(userId);
  if (preferred) return preferred;
  const fallback = publicApiBaseFromRequest(req);
  return isPlatformMainApiBase(fallback) ? null : fallback;
}

/**
 * `/api` na mesma origem onde a presell é servida. `spaUrl` pode ser absoluto (domínio técnico)
 * ou relativo (`/slug` em domínio de assinante) — nesse caso usa o host do pedido.
 */
export function sameOriginTrackApiBase(req: Request, spaUrl: string): string {
  if (/^https?:\/\//i.test(spaUrl)) return `${new URL(spaUrl).origin}/api`;
  const host = getRequestHostname(req);
  if (!host) return publicApiBaseFromRequest(req);
  const proto = /^(localhost|127\.0\.0\.1)$/i.test(host) ? "http" : "https";
  return `${proto}://${host}/api`;
}

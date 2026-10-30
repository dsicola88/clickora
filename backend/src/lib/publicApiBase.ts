import type { Request } from "express";
import { systemPrisma } from "./prisma";

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

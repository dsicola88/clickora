import type { Request } from "express";

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

import type { Request } from "express";

/** Base pública da API (com sufixo `/api`), para URLs em scripts e postbacks. */
export function publicApiBaseFromRequest(req: Request): string {
  const env = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.get("x-forwarded-host") || req.get("host") || `localhost:${process.env.PORT || 3001}`;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}/api`;
}

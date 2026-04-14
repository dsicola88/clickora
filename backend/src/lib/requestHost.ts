import type { Request } from "express";

/** Hostname em minúsculas, sem porta (para corresponder a `CustomDomain.hostname`). */
export function getRequestHostname(req: Request): string | null {
  const raw = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (!raw || typeof raw !== "string") return null;
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  const noPort = first.split(":")[0]?.trim().toLowerCase();
  return noPort || null;
}

import type { Request } from "express";

function firstHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length) return v[0];
  return undefined;
}

/** Hosts de infra (Railway, etc.) — não são o domínio do visitante quando há proxy em cadeia. */
function isForwardedInfrastructureHost(h: string): boolean {
  return (
    h.endsWith(".railway.app") ||
    h.endsWith(".railway.dev") ||
    h.endsWith(".run.app") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

function pushHostParts(raw: string | undefined, out: string[]): void {
  if (!raw || typeof raw !== "string") return;
  for (const part of raw.split(",")) {
    const hostOnly = part.trim().split(":")[0]?.trim().toLowerCase();
    if (hostOnly) out.push(hostOnly);
  }
}

function parseForwardedHeaderForHost(raw: string | undefined, out: string[]): void {
  if (!raw || typeof raw !== "string") return;
  const re = /\bhost=([^;,\s"]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const hostOnly = m[1].trim().replace(/^"|"$/g, "").split(":")[0]?.trim().toLowerCase();
    if (hostOnly) out.push(hostOnly);
  }
}

/**
 * Hostname público do visitante (minúsculas, sem porta), para corresponder a `CustomDomain.hostname`.
 *
 * Com Vercel → Railway, `Host` pode ser `*.railway.app`; por isso lemos vários forwarded headers
 * e preferimos o primeiro hostname que não seja infraestrutura.
 */
export function getRequestHostname(req: Request): string | null {
  const chain: string[] = [];

  pushHostParts(firstHeader(req, "x-forwarded-host"), chain);
  pushHostParts(firstHeader(req, "x-vercel-forwarded-host"), chain);
  pushHostParts(firstHeader(req, "x-original-host"), chain);
  pushHostParts(firstHeader(req, "cf-connecting-host"), chain);
  parseForwardedHeaderForHost(firstHeader(req, "forwarded"), chain);

  try {
    const h = req.hostname;
    if (typeof h === "string" && h.length) {
      const hostOnly = h.split(":")[0].trim().toLowerCase();
      if (hostOnly) chain.push(hostOnly);
    }
  } catch {
    // ignore
  }

  pushHostParts(firstHeader(req, "host"), chain);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const h of chain) {
    if (seen.has(h)) continue;
    seen.add(h);
    unique.push(h);
  }

  for (const h of unique) {
    if (!isForwardedInfrastructureHost(h)) return h;
  }
  return unique[0] ?? null;
}

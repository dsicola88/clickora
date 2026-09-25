import type { Request } from "express";

/**
 * Extrai o IP público do visitante atrás de Vercel → Railway / Cloudflare / proxies.
 * Não usar só `socket.remoteAddress` (é o hop interno, ex. EC2 Railway) nem o último XFF cegamente.
 */

function headerFirst(req: Request, name: string): string {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return (raw[0] || "").trim();
  return (raw || "").toString().trim();
}

/** Remove prefixo IPv4 mapeado em IPv6. */
export function normalizeClientIp(ip: string): string {
  let t = ip.trim().replace(/^\[|\]$/g, "");
  if (t.startsWith("::ffff:")) t = t.slice(7);
  return t;
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const n = normalizeClientIp(ip);
  if (!n) return true;
  if (n === "::1" || n === "0.0.0.0") return true;
  if (n.startsWith("fe80:") || n.startsWith("fc") || n.startsWith("fd")) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(n);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function firstPublicFromCsv(csv: string, skipExact?: string): string | null {
  const skip = skipExact ? normalizeClientIp(skipExact) : "";
  for (const part of csv.split(",")) {
    const ip = normalizeClientIp(part);
    if (!ip || isPrivateOrLocalIp(ip)) continue;
    if (skip && ip === skip) continue;
    return ip;
  }
  return null;
}

/**
 * Ordem: headers de CDN/edge que trazem o cliente real → XFF (público, ≠ hop socket) → Express `req.ip` → socket.
 */
export function extractClientIp(req: Request): string {
  const peer = normalizeClientIp(req.socket?.remoteAddress || "");

  const candidates: string[] = [
    headerFirst(req, "cf-connecting-ip"),
    headerFirst(req, "true-client-ip"),
    headerFirst(req, "x-vercel-forwarded-for"),
    headerFirst(req, "x-real-ip"),
    headerFirst(req, "x-client-ip"),
  ];

  for (const c of candidates) {
    if (!c) continue;
    const fromCsv = firstPublicFromCsv(c, peer);
    if (fromCsv) return fromCsv;
    const one = normalizeClientIp(c);
    if (one && !isPrivateOrLocalIp(one) && one !== peer) return one;
  }

  const xff = headerFirst(req, "x-forwarded-for");
  if (xff) {
    const pub = firstPublicFromCsv(xff, peer);
    if (pub) return pub;
    /** Cadeia só com o peer (comum se o proxy não reencaminhou o cliente). */
    const anyPub = firstPublicFromCsv(xff);
    if (anyPub && anyPub !== peer) return anyPub;
  }

  const forwarded = headerFirst(req, "forwarded");
  if (forwarded) {
    const m = /for=(?:"?\[?)([a-f0-9:.]+)(?:\]?"?)/i.exec(forwarded);
    if (m?.[1]) {
      const ip = normalizeClientIp(m[1]);
      if (ip && !isPrivateOrLocalIp(ip) && ip !== peer) return ip;
    }
  }

  const expressIp = typeof req.ip === "string" ? normalizeClientIp(req.ip) : "";
  if (expressIp && !isPrivateOrLocalIp(expressIp) && expressIp !== peer) return expressIp;

  return peer || expressIp || "";
}

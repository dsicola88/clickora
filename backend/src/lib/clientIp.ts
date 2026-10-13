import type { Request } from "express";
import { isCdn77EdgeIp } from "./cdn77Visitor";
import { isFastlyEdgeIp } from "./fastlyEdges";

/**
 * Extrai o IP público do visitante atrás de Vercel → Railway / Cloudflare.
 * O browser não escolhe o IP: `X-Client-IP`, `X-Real-IP` e `True-Client-IP` são ignorados.
 * Numa cadeia `X-Forwarded-For`, conta o público mais à direita, sem o hop do socket.
 */

function headerFirst(req: Request, name: string): string {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return (raw[0] || "").trim();
  return (raw || "").toString().trim();
}

/** Remove prefixo IPv4 mapeado em IPv6. */
export function normalizeClientIp(ip: string): string {
  let t = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();
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

function forwardedParts(csv: string): string[] {
  return csv
    .split(",")
    .map((part) => normalizeClientIp(part))
    .filter(Boolean);
}

/**
 * Cliente real numa cadeia em que o proxy acrescenta o hop no fim.
 * O endereço da esquerda é o que o browser pode ter escrito; usa-se o público mais à direita, sem o peer.
 * Se o peer é privado e a cadeia não termina nele, o último público é o que o proxy gravou.
 */
export function clientIpFromForwardedChain(csv: string, peer: string): string | null {
  const parts = forwardedParts(csv);
  if (parts.length === 0) return null;
  const hop = normalizeClientIp(peer);
  const last = parts[parts.length - 1];

  if (hop && last === hop) {
    for (let i = parts.length - 2; i >= 0; i--) {
      const ip = parts[i];
      if (!isPrivateOrLocalIp(ip) && ip !== hop) return ip;
    }
    return null;
  }

  if (hop && isPrivateOrLocalIp(hop)) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!isPrivateOrLocalIp(parts[i])) return parts[i];
    }
  }

  return null;
}

function isTransitEdgeIp(ip: string): boolean {
  return isCdn77EdgeIp(ip) || isFastlyEdgeIp(ip);
}

/**
 * A CDN põe o IP de quem clicou e o proxy acrescenta o nó no fim.
 * O nó não é o visitante: usa-se o público anterior. Sem esse hop, fica o nó.
 */
function visitorInFrontOfEdge(csv: string, edgeIp: string): string | null {
  const parts = forwardedParts(csv);
  let edgeAt = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] === edgeIp) {
      edgeAt = i;
      break;
    }
  }
  const start = edgeAt >= 0 ? edgeAt - 1 : parts.length - 1;
  for (let i = start; i >= 0; i--) {
    const ip = parts[i];
    if (!isPrivateOrLocalIp(ip) && !isTransitEdgeIp(ip)) return ip;
  }
  return null;
}

function unwrapTransitEdge(ip: string, xff: string): string {
  if (!ip || !isTransitEdgeIp(ip)) return ip;
  return (xff && visitorInFrontOfEdge(xff, ip)) || ip;
}

function rightmostPublic(csv: string, peer: string): string | null {
  const hop = normalizeClientIp(peer);
  const parts = forwardedParts(csv);
  for (let i = parts.length - 1; i >= 0; i--) {
    const ip = parts[i];
    if (!isPrivateOrLocalIp(ip) && ip !== hop) return ip;
  }
  return null;
}

/**
 * IP do visitante atrás de Railway / Vercel / Cloudflare.
 * `X-Client-IP`, `X-Real-IP` e `True-Client-IP` não escolhem o IP: o browser pode enviá-los.
 * `X-Forwarded-For` só conta quando o último hop é o socket, ou quando o socket é privado.
 * `CF-Connecting-IP` (com `CF-Ray`) e `X-Vercel-Forwarded-For` só entram quando o XFF não tem o cliente
 * — o caso Vercel → Railway, em que o XFF é só o hop.
 */
export function extractClientIp(req: Request): string {
  const peer = normalizeClientIp(req.socket?.remoteAddress || "");
  const xff = headerFirst(req, "x-forwarded-for");
  const fromXff = xff ? clientIpFromForwardedChain(xff, peer) : null;
  if (fromXff) return unwrapTransitEdge(fromXff, xff);

  const xffParts = xff ? forwardedParts(xff) : [];
  const xffTail = xffParts[xffParts.length - 1] || "";
  const sawProxy = (peer && isPrivateOrLocalIp(peer)) || (peer && xffTail === peer);
  if (!sawProxy) return unwrapTransitEdge(peer, xff);

  const cfRay = headerFirst(req, "cf-ray");
  if (cfRay) {
    const cf = rightmostPublic(headerFirst(req, "cf-connecting-ip"), peer);
    if (cf) return unwrapTransitEdge(cf, xff);
  }

  const vercel = rightmostPublic(headerFirst(req, "x-vercel-forwarded-for"), peer);
  if (vercel) return unwrapTransitEdge(vercel, xff);

  return unwrapTransitEdge(peer, xff);
}

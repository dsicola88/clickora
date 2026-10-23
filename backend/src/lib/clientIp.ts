import type { Request } from "express";
import { isCdn77EdgeIp } from "./cdn77Visitor";
import { isFastlyEdgeIp } from "./fastlyEdges";
import { classifyDatacenterIp } from "./ipNetworkClass";

/**
 * Extrai o IP público do visitante atrás de Vercel → Railway / Cloudflare.
 * O browser não escolhe o IP: `X-Client-IP` e `True-Client-IP` são ignorados.
 * `X-Real-IP` só conta quando o hop que chegou é um nó CDN77: é o IP de quem clicou.
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

/**
 * A CDN77 escreve o IP de quem clicou em X-Real-IP.
 * Só vale quando o hop que chegou ao servidor é um nó CDN77.
 * Um browser noutro IP não escolhe o endereço.
 */
function cdn77RealVisitorIp(req: Request, connectingIp: string): string | null {
  if (!isCdn77EdgeIp(connectingIp)) return null;
  const real = normalizeClientIp(headerFirst(req, "x-real-ip"));
  if (!real || isPrivateOrLocalIp(real) || isTransitEdgeIp(real)) return null;
  return real;
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

/** Peer é edge AWS/GCP/CDN77 (quando a lista cloud conhece o bloco). */
function isCloudPlatformPeer(ip: string): boolean {
  const net = classifyDatacenterIp(ip);
  return Boolean(net && (net.name === "AWS" || net.name === "GCP" || net.name === "CDN77"));
}

/**
 * Pedido chegou pelo rewrite Vercel → Railway (cabeçalhos que o browser não controla na prática
 * no mesmo hop; ligação directa ao Railway sem estes headers mantém o socket).
 */
function requestFromVercelInfra(req: Request): boolean {
  return Boolean(
    headerFirst(req, "x-vercel-forwarded-for") ||
      headerFirst(req, "x-vercel-id") ||
      headerFirst(req, "x-vercel-deployment-url"),
  );
}

/**
 * Visitante segundo Vercel (`X-Vercel-Forwarded-For`).
 * Preferir o primeiro hop público (cliente); a edge pode aparecer à direita.
 */
function vercelVisitorIp(req: Request, peer: string): string | null {
  const raw = headerFirst(req, "x-vercel-forwarded-for");
  if (!raw) return null;
  const parts = forwardedParts(raw);
  for (const ip of parts) {
    if (!isPrivateOrLocalIp(ip) && ip !== peer && !isTransitEdgeIp(ip) && !isCloudPlatformPeer(ip)) {
      return ip;
    }
  }
  return rightmostPublic(raw, peer);
}

/** Cliente no XFF quando o peer é outro hop público (edge Vercel → Railway). */
function publicClientBesidePeer(xff: string, peer: string): string | null {
  const parts = forwardedParts(xff);
  for (let i = parts.length - 1; i >= 0; i--) {
    const ip = parts[i]!;
    if (!isPrivateOrLocalIp(ip) && ip !== peer && !isTransitEdgeIp(ip) && !isCloudPlatformPeer(ip)) {
      return ip;
    }
  }
  return null;
}

/**
 * IP do visitante atrás de Railway / Vercel / Cloudflare.
 * `X-Client-IP` e `True-Client-IP` não escolhem o IP: o browser pode enviá-los.
 * `X-Real-IP` só entra se o hop observado ainda for um nó CDN77.
 * Rewrite Vercel → Railway: o socket é muitas vezes um IP AWS; o cliente vem em
 * `X-Vercel-Forwarded-For` e/ou no `X-Forwarded-For` (sem o peer no fim da cadeia).
 */
export function extractClientIp(req: Request): string {
  const peer = normalizeClientIp(req.socket?.remoteAddress || "");
  const xff = headerFirst(req, "x-forwarded-for");
  const xffParts = xff ? forwardedParts(xff) : [];
  const xffTail = xffParts[xffParts.length - 1] || "";
  const viaVercel = requestFromVercelInfra(req);
  const sawProxy =
    (peer && isPrivateOrLocalIp(peer)) ||
    (peer && xffTail === peer) ||
    (peer && isCloudPlatformPeer(peer)) ||
    viaVercel;

  const fromXff = xff ? clientIpFromForwardedChain(xff, peer) : null;
  const vercel = vercelVisitorIp(req, peer);
  const xffBesidePeer = xff && peer ? publicClientBesidePeer(xff, peer) : null;

  // Vercel → Railway: preferir visitante Vercel / cliente no XFF face ao peer AWS.
  if (sawProxy && vercel && (!fromXff || fromXff === peer || isTransitEdgeIp(fromXff) || isCloudPlatformPeer(fromXff))) {
    return unwrapTransitEdge(vercel, xff);
  }
  if (sawProxy && !fromXff && xffBesidePeer) {
    return unwrapTransitEdge(xffBesidePeer, xff);
  }

  if (fromXff) {
    const unwrapped = unwrapTransitEdge(fromXff, xff);
    const viaCdn = cdn77RealVisitorIp(req, unwrapped);
    if (viaCdn) return viaCdn;
    if (vercel && sawProxy && (isCloudPlatformPeer(unwrapped) || unwrapped === peer)) {
      return unwrapTransitEdge(vercel, xff);
    }
    return unwrapped;
  }

  if (!sawProxy) {
    const unwrapped = unwrapTransitEdge(peer, xff);
    return cdn77RealVisitorIp(req, unwrapped) || unwrapped;
  }

  const cfRay = headerFirst(req, "cf-ray");
  if (cfRay) {
    const cf = rightmostPublic(headerFirst(req, "cf-connecting-ip"), peer);
    if (cf) return unwrapTransitEdge(cf, xff);
  }

  if (vercel) return unwrapTransitEdge(vercel, xff);
  if (xffBesidePeer) return unwrapTransitEdge(xffBesidePeer, xff);

  const unwrapped = unwrapTransitEdge(peer, xff);
  return cdn77RealVisitorIp(req, unwrapped) || unwrapped;
}

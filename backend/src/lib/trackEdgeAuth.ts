import type { Request } from "express";
import { isCdn77EdgeIp } from "./cdn77Visitor";
import { isPrivateOrLocalIp, normalizeClientIp } from "./clientIp";
import { isFastlyEdgeIp } from "./fastlyEdges";

/**
 * Segredo partilhado Worker ↔ origin (`TRACK_EDGE_SHARED_SECRET`).
 * Em produção, sem TRACK_EDGE, cai no JWT_SECRET (mesmo contrato que getEdgeDest).
 */
export function trackEdgeSharedSecret(): string {
  return (
    process.env.TRACK_EDGE_SHARED_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" || process.env.TRACK_EDGE_REQUIRE_SECRET === "1"
      ? process.env.JWT_SECRET?.trim() || ""
      : "")
  );
}

/** Pedido autenticado pelo Worker (header `x-clickora-edge-secret`). */
export function requestFromTrustedTrackEdge(req: Request): boolean {
  const secret = trackEdgeSharedSecret();
  if (!secret) return false;
  return String(req.get("x-clickora-edge-secret") || "").trim() === secret;
}

/**
 * País ISO que o Cloudflare atribui ao visitante (`CF-IPCountry`).
 * Só usar quando o pedido vem do Worker autenticado — o browser não controla esse header no hop Worker→origin.
 */
export function cloudflareVisitorCountryFromRequest(req: Request): string | null {
  const code = String(req.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (code === "XX" || code === "T1") return null;
  return code;
}

function usableVisitorIp(raw: string | undefined | null): string | null {
  const ip = normalizeClientIp(String(raw || "").trim());
  if (!ip || isPrivateOrLocalIp(ip)) return null;
  if (isCdn77EdgeIp(ip) || isFastlyEdgeIp(ip)) return null;
  return ip;
}

/**
 * IP do visitante no hop Worker → origin.
 * `extractClientIp` só confia em `CF-Connecting-IP` com `CF-Ray` (proxy CF clássico).
 * O fetch do Worker para o Railway não traz `CF-Ray`; o secret autentica o hop.
 */
export function visitorIpFromTrustedTrackEdge(req: Request): string | null {
  if (!requestFromTrustedTrackEdge(req)) return null;
  const fromCf = usableVisitorIp(req.get("cf-connecting-ip"));
  if (fromCf) return fromCf;
  const xff = String(req.get("x-forwarded-for") || "");
  const first = xff.split(",")[0];
  return usableVisitorIp(first);
}

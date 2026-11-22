import { isPresellUuidParam } from "@/lib/publicPresellOrigin";

function isTenantPresellHost(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0];
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1") return false;
  if (h.endsWith(".vercel.app")) return false;
  if (h === "dclickora.com" || h === "www.dclickora.com") return false;
  if (h === "clickora.com" || h === "www.clickora.com") return false;
  return true;
}

/**
 * Segmentos de 1º nível reservados — nunca tratados como slug de presell em domínio tenant.
 * Mantém rotas legais, auth e app dashboard acessíveis no mesmo host.
 */
const RESERVED_BARE_SEGMENTS = new Set(
  [
    "api",
    "assets",
    "auth",
    "p",
    "l",
    "planos",
    "plans",
    "privacidade",
    "termos",
    "aviso-medico",
    "aviso-cookies",
    "reset-password",
    "presell-para-afiliados",
    "super-presell",
    "rastreamento-afiliados",
    "guia-vendas-afiliados",
    "presell",
    "tracking",
    "resultados",
    "integrations",
    "settings",
    "admin",
    "account",
    "home",
    "presells",
    "plataformas",
    "relatorios",
    "analytics",
    "rotadores",
    "blacklist",
    "url-builder",
    "logs",
    "vendas",
    "campaigns",
    "create-presell",
    "keywords",
    "lessons",
    "agency-ready",
    "setup-assistant",
    "robots.txt",
    "manifest.webmanifest",
    "sw-push.js",
    "favicon.ico",
    "favicon.svg",
  ].map((s) => s.toLowerCase()),
);

export function isReservedBarePresellSegment(segment: string): boolean {
  const s = segment.trim();
  if (!s) return true;
  if (isPresellUuidParam(s)) return false;
  if (s.includes(".")) return true;
  return RESERVED_BARE_SEGMENTS.has(s.toLowerCase());
}

/** Um único segmento `/foo` ou `/foo/` (não `/foo/bar`). */
export function parseBarePresellSegment(pathname: string): string | null {
  const raw = (pathname || "").replace(/\/+$/, "") || "/";
  if (raw === "/") return null;
  const parts = raw.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  try {
    return decodeURIComponent(parts[0]!);
  } catch {
    return parts[0]!;
  }
}

/**
 * Path público estilo SuperPresell (`/kerassentials/`) — só em domínio tenant (não marketing/dev).
 */
export function isTenantBarePresellPathname(pathname: string, hostname: string): boolean {
  if (!isTenantPresellHost(hostname)) return false;
  const seg = parseBarePresellSegment(pathname);
  if (!seg) return false;
  return !isReservedBarePresellSegment(seg);
}

/** Lander pública: `/p/`, `/l/` ou slug bare no tenant. */
export function isAnyPublicPresellPathname(pathname: string, hostname: string): boolean {
  if (/^\/(?:p|l)\/[^/]+/i.test(pathname)) return true;
  return isTenantBarePresellPathname(pathname, hostname);
}
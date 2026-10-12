import type { Request } from "express";
import { CDN77_EDGE_PREFIXES } from "./cdn77Edges";
import { countryIsoFromIp, geoLookupFromIp, type GeoIpLookupResult } from "./countryFromIp";

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim().replace(/^::ffff:/i, ""));
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((n) => n > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function inPrefix(ip: number, base: number, bits: number): boolean {
  if (bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

/** IP de um nó CDN77 (AS60068). Não é o endereço de quem clicou. */
export function isCdn77EdgeIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const n = ipv4ToInt(ip);
  if (n == null) return false;
  return CDN77_EDGE_PREFIXES.some(([base, bits]) => inPrefix(n, base, bits));
}

export type VisitorCountrySource = "cdn77" | "geoip" | "none";

export type VisitorCountry = {
  country: string | null;
  source: VisitorCountrySource;
};

function headerValue(headers: Record<string, string | string[] | undefined> | undefined, name: string): string {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(raw)) return (raw[0] || "").trim();
  return (raw || "").toString().trim();
}

/**
 * País ISO do visitante que a CDN77 calcula a partir do IP real.
 * Só vale quando o IP observado é um nó CDN77. Um browser noutro IP não escolhe o país.
 * XX / T1 não são países.
 */
export function cdn77VisitorCountryFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
  ip: string | null | undefined,
): string | null {
  if (!isCdn77EdgeIp(ip)) return null;
  const code = headerValue(headers, "x-client-geo-country").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (code === "XX" || code === "T1") return null;
  return code;
}

export function resolveVisitorCountry(
  headers: Record<string, string | string[] | undefined> | undefined,
  ip: string | null | undefined,
): VisitorCountry {
  const fromCdn = cdn77VisitorCountryFromHeaders(headers, ip);
  if (fromCdn) return { country: fromCdn, source: "cdn77" };
  if (isCdn77EdgeIp(ip)) return { country: null, source: "none" };
  const country = countryIsoFromIp(ip);
  return { country, source: country ? "geoip" : "none" };
}

export function resolveVisitorCountryFromRequest(req: Request, ip: string | null | undefined): VisitorCountry {
  return resolveVisitorCountry(req.headers as Record<string, string | string[] | undefined>, ip);
}

export type IpToolLookup = {
  found: boolean;
  network: "CDN77" | null;
  /** False quando o IP é um nó CDN77: a base geográfica não é o país de quem acedeu. */
  visitor_located: boolean;
  message: string | null;
  geo: GeoIpLookupResult | null;
};

/**
 * Rastrear IP. Num nó CDN77 a base GeoLite (muitas vezes Brasil, sem cidade,
 * precisão de 1000 km) não é a localização de quem acedeu.
 */
export function lookupIpForTools(ip: string): IpToolLookup {
  const geo = geoLookupFromIp(ip);
  if (isCdn77EdgeIp(ip)) {
    const reading = geo
      ? `A base GeoLite marca este nó como ${geo.country_code}, fuso ${geo.timezone || "desconhecido"}, precisão ${geo.area_km > 0 ? `${geo.area_km} km` : "desconhecida"}${geo.city ? `, cidade ${geo.city}` : ", sem cidade"}.`
      : "A base GeoLite não tem entrada para este nó.";
    return {
      found: true,
      network: "CDN77",
      visitor_located: false,
      message: `Este IP é um nó da CDN77 (AS60068). Não é o endereço de quem acedeu, por isso o país dessa pessoa não se lê daqui. ${reading} Essa leitura fica de lado.`,
      geo,
    };
  }
  if (!geo) {
    return {
      found: false,
      network: null,
      visitor_located: false,
      message:
        "Sem dados de localização para este IP (rede privada, localhost ou a base GeoLite não tem entrada). Experimenta um IP público (ex.: 8.8.8.8).",
      geo: null,
    };
  }
  return { found: true, network: null, visitor_located: true, message: null, geo };
}

export function countrySourceMeta(source: VisitorCountrySource): Record<string, string> {
  if (source === "cdn77") return { country_source: "cdn77" };
  return {};
}

type DatacenterPlace = { country: string | null; region: string | null } | null;
type GeoPlace = { country_code?: string | null; region?: string | null; city?: string | null } | null;

/**
 * País, região e cidade para o relatório.
 * Nó CDN77 sem país do visitante: vazio. Não se usa a base geográfica do nó
 * (inventava CZ, UA, GB e cidades como Odesa).
 */
export function locationForStoredClick(input: {
  ip: string | null | undefined;
  storedCountry: string | null;
  countrySource: unknown;
  datacenter: DatacenterPlace;
  geo: GeoPlace;
}): { country: string | null; region: string | null; city: string | null } {
  const fromVisitor = input.countrySource === "cdn77" && input.storedCountry;
  if (fromVisitor) {
    return { country: input.storedCountry, region: null, city: null };
  }
  if (isCdn77EdgeIp(input.ip) && !input.datacenter) {
    return { country: null, region: null, city: null };
  }
  const country =
    input.datacenter?.country ??
    input.storedCountry ??
    (input.geo?.country_code ? String(input.geo.country_code).trim().toUpperCase() : null) ??
    null;
  const region = input.datacenter?.region ?? (input.geo?.region?.trim() || null);
  const city = input.datacenter ? null : input.geo?.city?.trim() || null;
  return { country, region, city };
}

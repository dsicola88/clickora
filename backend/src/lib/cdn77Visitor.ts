import type { Request } from "express";
import { CDN77_EDGE_PREFIXES } from "./cdn77Edges";
import { countryIsoFromIp, geoLookupFromIp, type GeoIpLookupResult } from "./countryFromIp";
import { isFastlyEdgeIp } from "./fastlyEdges";

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

function xffHops(headers: Record<string, string | string[] | undefined> | undefined): string[] {
  return headerValue(headers, "x-forwarded-for")
    .split(",")
    .map((part) => part.trim().replace(/^::ffff:/i, ""))
    .filter(Boolean);
}

function isPlatformTail(ip: string): boolean {
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * A ligação chegou por um nó CDN77.
 * Só o último hop da cadeia conta: um browser não escolhe o país
 * metendo um nó falso a meio da lista. Se a plataforma acrescenta
 * um hop privado depois do nó, esse hop anterior também conta.
 */
export function requestCameThroughCdn77(
  headers: Record<string, string | string[] | undefined> | undefined,
  ip: string | null | undefined,
): boolean {
  if (isCdn77EdgeIp(ip)) return true;
  const hops = xffHops(headers);
  const last = hops[hops.length - 1];
  if (isCdn77EdgeIp(last)) return true;
  const before = hops[hops.length - 2];
  return Boolean(last && before && isPlatformTail(last) && isCdn77EdgeIp(before));
}

/**
 * País ISO do visitante que a CDN77 calcula a partir do IP real.
 * Só vale quando a ligação chegou por um nó CDN77. Um browser noutro IP não escolhe o país.
 * XX / T1 não são países.
 */
export function cdn77VisitorCountryFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
  ip: string | null | undefined,
): string | null {
  if (!requestCameThroughCdn77(headers, ip)) return null;
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

export type EdgeNetworkName = "CDN77" | "Fastly";

export type IpToolLookup = {
  found: boolean;
  network: EdgeNetworkName | null;
  network_label: string | null;
  /** False quando o IP é um nó de CDN: a base geográfica não é o país de quem acedeu. */
  visitor_located: boolean;
  message: string | null;
  geo: GeoIpLookupResult | null;
};

const EDGE_LABEL: Record<EdgeNetworkName, string> = {
  CDN77: "CDN77 (AS60068)",
  Fastly: "Fastly (AS54113)",
};

function edgeToolLookup(network: EdgeNetworkName, geo: GeoIpLookupResult | null): IpToolLookup {
  const reading = geo
    ? `A base GeoLite marca este nó como ${geo.country_code}, fuso ${geo.timezone || "desconhecido"}, precisão ${geo.area_km > 0 ? `${geo.area_km} km` : "desconhecida"}${geo.city ? `, cidade ${geo.city}` : ", sem cidade"}.`
    : "A base GeoLite não tem entrada para este nó.";
  return {
    found: true,
    network,
    network_label: EDGE_LABEL[network],
    visitor_located: false,
    message: `Este IP é um nó da ${EDGE_LABEL[network]}. Não é o endereço de quem acedeu, por isso o país dessa pessoa não se lê daqui. ${reading} Essa leitura fica de lado.`,
    geo,
  };
}

/**
 * Rastrear IP. Num nó CDN77 ou Fastly a base GeoLite não é a localização
 * de quem acedeu: o mesmo endereço aparece como Brasil, Suécia ou Estados Unidos
 * conforme a base, e nenhuma dessas leituras é a pessoa.
 */
export function lookupIpForTools(ip: string): IpToolLookup {
  const geo = geoLookupFromIp(ip);
  if (isCdn77EdgeIp(ip)) return edgeToolLookup("CDN77", geo);
  if (isFastlyEdgeIp(ip)) return edgeToolLookup("Fastly", geo);
  if (!geo) {
    return {
      found: false,
      network: null,
      visitor_located: false,
      message:
        "Sem dados de localização para este IP (rede privada, localhost ou a base GeoLite não tem entrada). Experimenta um IP público (ex.: 8.8.8.8).",
      geo: null,
      network_label: null,
    };
  }
  return {
    found: true,
    network: null,
    network_label: null,
    visitor_located: false,
    message:
      "Isto é uma estimativa da base GeoLite para o endereço consultado. Não é a localização confirmada de uma pessoa e não entra nos relatórios.",
    geo,
  };
}

export function countrySourceMeta(source: VisitorCountrySource): Record<string, string> {
  if (source === "cdn77") return { country_source: "cdn77" };
  if (source === "geoip") return { country_source: "visitor_ip" };
  return {};
}

type DatacenterPlace = { country: string | null; region: string | null } | null;
type GeoPlace = { country_code?: string | null; region?: string | null; city?: string | null } | null;

/**
 * País no relatório, a mesma leitura que a rede de afiliados faz do visitante.
 * CDN77: o país que a CDN calculou no IP real.
 * IP de quem clicou: o país desse IP, gravado na hora (country_source visitor_ip).
 * Nó CDN ou país antigo sem essa origem: vazio. Não se publica cidade.
 */
export function locationForStoredClick(input: {
  ip: string | null | undefined;
  storedCountry: string | null;
  countrySource: unknown;
  datacenter: DatacenterPlace;
  geo: GeoPlace;
}): { country: string | null; region: string | null; city: string | null } {
  void input.datacenter;
  void input.geo;
  const country = input.storedCountry?.trim().toUpperCase() || null;
  if (!country) return { country: null, region: null, city: null };
  if (input.countrySource === "cdn77") return { country, region: null, city: null };
  if (isFastlyEdgeIp(input.ip) || isCdn77EdgeIp(input.ip)) return { country: null, region: null, city: null };
  if (input.countrySource === "visitor_ip") return { country, region: null, city: null };
  return { country: null, region: null, city: null };
}

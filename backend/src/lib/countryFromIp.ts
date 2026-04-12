import geoip from "geoip-lite";

/** Remove prefixo IPv4 mapeado em IPv6 (::ffff:x.x.x.x). */
function normalizeIp(ip: string): string {
  const t = ip.trim();
  if (t.startsWith("::ffff:")) return t.slice(7);
  return t;
}

/**
 * Código ISO 3166-1 alpha-2 (ex.: PT, BR) a partir do IP público.
 * IPs locais/privados ou desconhecidos → null.
 */
export function countryIsoFromIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const n = normalizeIp(ip);
  if (!n || n === "" || n === "::1") return null;
  const geo = geoip.lookup(n);
  const c = geo?.country ?? null;
  return c ? c.trim().toUpperCase() : null;
}

/** Dados GeoLite2 (cidade, região, etc.) para ferramenta «Rastrear IP». */
export type GeoIpLookupResult = {
  country_code: string;
  region: string;
  city: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  eu: boolean;
  metro: number;
  area_km: number;
};

/**
 * Localização aproximada a partir do IP (MaxMind GeoLite2 em geoip-lite).
 * IPs privados / localhost / sem entrada na base → null.
 */
export function geoLookupFromIp(ip: string | null | undefined): GeoIpLookupResult | null {
  if (!ip) return null;
  const n = normalizeIp(ip);
  if (!n || n === "" || n === "::1") return null;
  const geo = geoip.lookup(n);
  if (!geo) return null;
  return {
    country_code: geo.country.trim().toUpperCase(),
    region: geo.region,
    city: geo.city,
    timezone: geo.timezone,
    latitude: geo.ll?.[0] ?? null,
    longitude: geo.ll?.[1] ?? null,
    eu: geo.eu === "1",
    metro: geo.metro,
    area_km: geo.area,
  };
}

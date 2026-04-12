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

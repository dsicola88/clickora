/**
 * Lista de IPs cloud/datacenter do relatório para colar em
 * Google Ads → Definições da campanha → Exclusões de IP.
 * Só IPv4 válidos; sem inventar endereços.
 */

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export type ExclusionIpRow = {
  ip: string;
  statusKind?: string;
};

/** Extrai IPs únicos de linhas Situação = datacenter (cloud). */
export function collectDatacenterIpsForGoogleAdsExclusion(
  rows: ExclusionIpRow[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (row.statusKind !== "datacenter") continue;
    const ip = String(row.ip || "").trim().replace(/^::ffff:/i, "");
    if (!IPV4.test(ip)) continue;
    if (seen.has(ip)) continue;
    seen.add(ip);
    out.push(ip);
  }
  return out.sort();
}

/** Texto pronto a colar (um IP por linha) — limite típico Google Ads ~500. */
export function formatGoogleAdsIpExclusionList(ips: string[], max = 500): string {
  return ips.slice(0, max).join("\n");
}

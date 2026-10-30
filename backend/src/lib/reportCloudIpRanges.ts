/**
 * CIDRs só para a coluna Situação nos Relatórios.
 *
 * NÃO entra em:
 * - cloudIpRanges / clientIp (extracção de IP)
 * - auto-blacklist
 * - trackGuard / cloaking / safe page
 *
 * Actualizar: acrescentar { name, place, country, base, bits } quando
 * aparecerem blocos novos de auditoria (Google / Azure / DO / etc.).
 * Preferir prefixes oficiais documentados; bits >= 16 para evitar falsos positivos.
 */
export type ReportCloudNetwork = {
  name: string;
  place: string;
  country: string;
  base: string;
  bits: number;
};

/**
 * Listas estáticas de cloud/hosting vistas em auditorias Ads com UA «residencial».
 * Fontes típicas: RIPE/ARIN whois, Googlebot IP ranges, Azure service tags (resumo).
 */
export const REPORT_CLOUD_NETWORKS: ReportCloudNetwork[] = [
  // Google LLC — proxies / crawlers (ex.: 66.102.8.x nos relatórios)
  { name: "Google", place: "Google LLC", country: "US", base: "66.102.0.0", bits: 20 },
  { name: "Google", place: "Google LLC", country: "US", base: "66.249.64.0", bits: 19 },
  { name: "Google", place: "Google LLC", country: "US", base: "64.233.160.0", bits: 19 },
  { name: "Google", place: "Google LLC", country: "US", base: "72.14.192.0", bits: 18 },
  { name: "Google", place: "Google LLC", country: "US", base: "74.125.0.0", bits: 16 },
  { name: "Google", place: "Google LLC", country: "US", base: "209.85.128.0", bits: 17 },
  { name: "Google", place: "Google LLC", country: "US", base: "216.239.32.0", bits: 19 },
  { name: "Google", place: "Google LLC", country: "US", base: "172.217.0.0", bits: 16 },
  { name: "Google", place: "Google LLC", country: "US", base: "142.250.0.0", bits: 15 },
  { name: "Google", place: "Google LLC", country: "US", base: "35.190.0.0", bits: 16 },
  { name: "Google", place: "Google LLC", country: "US", base: "35.191.0.0", bits: 16 },
  { name: "Google", place: "Google LLC", country: "US", base: "130.211.0.0", bits: 16 },

  // Microsoft Azure — ex.: 23.100.x.x
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "23.96.0.0", bits: 13 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "13.64.0.0", bits: 11 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "40.64.0.0", bits: 10 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "52.224.0.0", bits: 11 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "104.40.0.0", bits: 13 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "168.61.0.0", bits: 16 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "168.62.0.0", bits: 15 },
  { name: "Azure", place: "Microsoft Azure", country: "US", base: "168.63.0.0", bits: 16 },

  // DigitalOcean
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "104.131.0.0", bits: 16 },
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "159.65.0.0", bits: 16 },
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "167.99.0.0", bits: 16 },
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "138.68.0.0", bits: 16 },
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "157.245.0.0", bits: 16 },
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "164.90.0.0", bits: 16 },
  { name: "DigitalOcean", place: "DigitalOcean", country: "US", base: "206.189.0.0", bits: 16 },

  // AWS China (por vezes ausente do bootstrap US) — ex.: 54.222.x.x
  { name: "AWS", place: "AWS China", country: "CN", base: "54.222.0.0", bits: 16 },
  { name: "AWS", place: "AWS China", country: "CN", base: "52.80.0.0", bits: 15 },
];

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((n) => n > 255)) return null;
  return (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0);
}

function inCidr(ip: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base);
  if (b == null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (b & mask);
}

/** Match mais específico (maior bits) para o relatório. */
export function classifyReportCloudIp(ip: string | null | undefined): ReportCloudNetwork | null {
  if (!ip) return null;
  const n = ipv4ToInt(ip.trim().replace(/^::ffff:/i, ""));
  if (n == null) return null;
  let best: ReportCloudNetwork | null = null;
  for (const net of REPORT_CLOUD_NETWORKS) {
    if (!inCidr(n, net.base, net.bits)) continue;
    if (!best || net.bits > best.bits) best = net;
  }
  return best;
}

/** Metadata de ingest (clique) — alinha KPI a Situação Cloud sem auto-blacklist. */
export function reportCloudClickMeta(ip: string | null | undefined): Record<string, unknown> {
  const net = classifyReportCloudIp(ip);
  if (!net) return {};
  return {
    ip_quality: "datacenter",
    ip_network: net.name,
    ip_network_place: net.place,
    unqualified: true,
    unqualified_reason: `Rede ${net.name} (${net.place}). Cloud/hosting — fora do KPI; só relatório.`,
    exclude_from_kpi: true,
    datacenter_auto_blacklist: false,
    report_cloud_only: true,
  };
}

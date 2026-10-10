/**
 * Redes de datacenter/CDN cujo IP de saída não é um acesso residencial.
 * Cada bloco foi confirmado no registo (RIPE/ARIN), não na base geográfica.
 * 152.233.29.1 está em CDN77-LON (Londres, GB); o GeoIP antigo marcava BR.
 */
export type DatacenterNetwork = {
  name: string;
  /** Sítio do registo, para a coluna região. Não é a cidade do comprador. */
  place: string;
  country: string;
  /** Base IPv4 e prefixo. */
  base: string;
  bits: number;
};

const NETWORKS: DatacenterNetwork[] = [
  { name: "CDN77", place: "Londres", country: "GB", base: "152.233.28.0", bits: 23 },
];

export type ClickPlace = {
  country: string | null;
  region: string | null;
  unqualified: boolean;
  ip_network: string | null;
  ip_network_place: string | null;
  unqualified_reason: string | null;
};

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((n) => n > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function inCidr(ip: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base);
  if (b == null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (b & mask);
}

export function classifyDatacenterIp(ip: string | null | undefined): DatacenterNetwork | null {
  if (!ip) return null;
  const n = ipv4ToInt(ip.trim().replace(/^::ffff:/i, ""));
  if (n == null) return null;
  return NETWORKS.find((net) => inCidr(n, net.base, net.bits)) ?? null;
}

export function datacenterClickPlace(ip: string | null | undefined): ClickPlace | null {
  const net = classifyDatacenterIp(ip);
  if (!net) return null;
  return {
    country: net.country,
    region: net.place,
    unqualified: true,
    ip_network: net.name,
    ip_network_place: net.place,
    unqualified_reason: `Rede ${net.name} (${net.place}). Não é um acesso de casa ou telemóvel. Pode ser VPN ou proxy. Este clique não é qualificado e não abre o hoplink.`,
  };
}

export function datacenterClickMeta(ip: string | null | undefined): Record<string, unknown> {
  const place = datacenterClickPlace(ip);
  if (!place) return {};
  return {
    ip_quality: "datacenter",
    ip_network: place.ip_network,
    ip_network_place: place.ip_network_place,
    unqualified: true,
    unqualified_reason: place.unqualified_reason,
    exclude_from_kpi: true,
  };
}

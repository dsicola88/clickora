/**
 * Redes de datacenter/CDN cujo IP de saída não é um acesso residencial.
 * Só CDN77 (RIPE) + AWS/GCP oficiais (ou bootstrap AWS confirmado).
 */
import { getCloudDatacenterNetworks } from "./cloudIpRanges";

export type DatacenterNetworkSource =
  | "static"
  | "aws_official"
  | "gcp_official"
  | "bootstrap_confirmed";

export type DatacenterNetwork = {
  name: string;
  /** Sítio do registo / região cloud — não é a cidade do comprador. */
  place: string;
  country: string;
  base: string;
  bits: number;
  /** Origem da evidência — só redes explícitas entram em auto-blacklist. */
  source?: DatacenterNetworkSource;
};

/** Blocos fixos (RIPE / evidência documentada no código). */
const STATIC_NETWORKS: DatacenterNetwork[] = [
  {
    name: "CDN77",
    place: "Londres",
    country: "GB",
    base: "152.233.28.0",
    bits: 23,
    source: "static",
  },
];

/** Redes com evidência explícita — únicas elegíveis para blacklist automática. */
const AUTO_BLACKLIST_NETWORKS = new Set(["CDN77", "AWS", "GCP"]);

export type ClickPlace = {
  country: string | null;
  region: string | null;
  unqualified: boolean;
  ip_network: string | null;
  ip_network_place: string | null;
  unqualified_reason: string | null;
  /** true = seguro auto-blacklistar; false = só marcar no relatório. */
  auto_blacklist: boolean;
};

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

function allNetworks(): DatacenterNetwork[] {
  return [...STATIC_NETWORKS, ...getCloudDatacenterNetworks()];
}

export function classifyDatacenterIp(ip: string | null | undefined): DatacenterNetwork | null {
  if (!ip) return null;
  const n = ipv4ToInt(ip.trim().replace(/^::ffff:/i, ""));
  if (n == null) return null;
  let best: DatacenterNetwork | null = null;
  for (const net of allNetworks()) {
    if (!inCidr(n, net.base, net.bits)) continue;
    if (!best || net.bits > best.bits) best = net;
  }
  return best;
}

/**
 * Auto-blacklist só com nome conhecido + fonte explícita (oficial / static / bootstrap confirmado).
 * Nunca por heurística vaga.
 */
export function isExplicitDatacenterForAutoBlacklist(net: DatacenterNetwork | null | undefined): boolean {
  if (!net) return false;
  if (!AUTO_BLACKLIST_NETWORKS.has(net.name)) return false;
  const src = net.source || "static";
  return (
    src === "static" ||
    src === "aws_official" ||
    src === "gcp_official" ||
    src === "bootstrap_confirmed"
  );
}

export function datacenterClickPlace(ip: string | null | undefined): ClickPlace | null {
  const net = classifyDatacenterIp(ip);
  if (!net) return null;
  const auto = isExplicitDatacenterForAutoBlacklist(net);
  return {
    country: net.country,
    region: net.place,
    unqualified: true,
    ip_network: net.name,
    ip_network_place: net.place,
    unqualified_reason: `Rede ${net.name} (${net.place}, evidência ${net.source || "static"}). IP de cloud/CDN — não é acesso residencial típico. Clique não qualificado; hoplink não abre.`,
    auto_blacklist: auto,
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
    datacenter_auto_blacklist: place.auto_blacklist,
  };
}

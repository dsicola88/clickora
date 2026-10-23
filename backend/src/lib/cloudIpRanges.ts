/**
 * Prefixos IPv4 de cloud (AWS / GCP) para classificar cliques de datacenter.
 * Atualiza em background; bootstrap cobre os blocos EC2 vistos em tráfego Ads inválido.
 */
import type { DatacenterNetwork } from "./ipNetworkClass";

type MutableRange = DatacenterNetwork;

const AWS_RANGES_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json";
const GCP_RANGES_URL = "https://www.gstatic.com/ipranges/cloud.json";

/** Bootstrap síncrono — inclui os EC2 us-west-1 do relatório Visivra (18.144 / 52.52 / 54.67). */
const BOOTSTRAP: MutableRange[] = [
  { name: "AWS", place: "us-west-1", country: "US", base: "18.144.0.0", bits: 15 },
  { name: "AWS", place: "us-west-1", country: "US", base: "52.52.0.0", bits: 15 },
  { name: "AWS", place: "us-west-1", country: "US", base: "54.67.0.0", bits: 16 },
  { name: "AWS", place: "us-east-1", country: "US", base: "3.80.0.0", bits: 12 },
  { name: "AWS", place: "us-east-1", country: "US", base: "54.144.0.0", bits: 14 },
  { name: "AWS", place: "eu-west-1", country: "IE", base: "34.240.0.0", bits: 13 },
  { name: "GCP", place: "global", country: "US", base: "34.64.0.0", bits: 10 },
  { name: "GCP", place: "global", country: "US", base: "35.184.0.0", bits: 13 },
  { name: "Azure", place: "global", country: "US", base: "20.33.0.0", bits: 16 },
  { name: "Azure", place: "global", country: "US", base: "40.74.0.0", bits: 15 },
  { name: "DigitalOcean", place: "global", country: "US", base: "104.131.0.0", bits: 16 },
  { name: "DigitalOcean", place: "global", country: "US", base: "167.99.0.0", bits: 16 },
  { name: "Hetzner", place: "EU", country: "DE", base: "49.12.0.0", bits: 15 },
  { name: "Hetzner", place: "EU", country: "DE", base: "95.216.0.0", bits: 16 },
];

let dynamicRanges: MutableRange[] = [...BOOTSTRAP];
let lastRefreshAt = 0;
let refreshInflight: Promise<void> | null = null;

function parseCidr(cidr: string): { base: string; bits: number } | null {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!m) return null;
  const bits = Number(m[2]);
  if (!Number.isFinite(bits) || bits < 8 || bits > 32) return null;
  return { base: m[1]!, bits };
}

function countryFromAwsRegion(region: string): string {
  const r = region.toLowerCase();
  if (r.startsWith("us-") || r === "aws") return "US";
  if (r.startsWith("eu-") || r.startsWith("eusc-")) return "IE";
  if (r.startsWith("ap-southeast-2")) return "AU";
  if (r.startsWith("ap-northeast-1")) return "JP";
  if (r.startsWith("ap-south-1")) return "IN";
  if (r.startsWith("ap-")) return "SG";
  if (r.startsWith("sa-")) return "BR";
  if (r.startsWith("ca-")) return "CA";
  if (r.startsWith("af-")) return "ZA";
  if (r.startsWith("me-")) return "AE";
  return "US";
}

async function fetchJson(url: string): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: "application/json", "User-Agent": "ClickoraCloudIpRanges/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function loadAwsPrefixes(raw: unknown): MutableRange[] {
  if (!raw || typeof raw !== "object") return [];
  const prefixes = (raw as { prefixes?: unknown }).prefixes;
  if (!Array.isArray(prefixes)) return [];
  const out: MutableRange[] = [];
  for (const row of prefixes) {
    if (!row || typeof row !== "object") continue;
    const p = row as { ip_prefix?: string; region?: string; service?: string };
    const service = String(p.service || "");
    /** EC2 + AMAZON cobrem saída de bots/crawlers em instâncias; exclui só CLOUDFRONT se aparecer sozinho. */
    if (service !== "EC2" && service !== "AMAZON") continue;
    const cidr = parseCidr(String(p.ip_prefix || ""));
    if (!cidr) continue;
    const region = String(p.region || "global");
    out.push({
      name: "AWS",
      place: region,
      country: countryFromAwsRegion(region),
      base: cidr.base,
      bits: cidr.bits,
    });
  }
  return out;
}

function loadGcpPrefixes(raw: unknown): MutableRange[] {
  if (!raw || typeof raw !== "object") return [];
  const prefixes = (raw as { prefixes?: unknown }).prefixes;
  if (!Array.isArray(prefixes)) return [];
  const out: MutableRange[] = [];
  for (const row of prefixes) {
    if (!row || typeof row !== "object") continue;
    const p = row as { ipv4Prefix?: string; scope?: string };
    const cidr = parseCidr(String(p.ipv4Prefix || ""));
    if (!cidr) continue;
    const scope = String(p.scope || "global");
    out.push({
      name: "GCP",
      place: scope,
      country: scope.toLowerCase().startsWith("us") ? "US" : "US",
      base: cidr.base,
      bits: cidr.bits,
    });
  }
  return out;
}

/** Lista actual (bootstrap até ao 1.º refresh bem-sucedido). */
export function getCloudDatacenterNetworks(): readonly DatacenterNetwork[] {
  return dynamicRanges;
}

export function cloudIpRangesStatus(): { count: number; lastRefreshAt: number } {
  return { count: dynamicRanges.length, lastRefreshAt };
}

/**
 * Descarrega listas públicas AWS + GCP e substitui a tabela dinâmica.
 * Em falha mantém bootstrap / última lista boa.
 */
export async function refreshCloudIpRanges(): Promise<{ ok: boolean; count: number; error?: string }> {
  if (refreshInflight) {
    await refreshInflight;
    return { ok: true, count: dynamicRanges.length };
  }
  refreshInflight = (async () => {
    const merged: MutableRange[] = [...BOOTSTRAP];
    try {
      const awsRaw = await fetchJson(AWS_RANGES_URL);
      merged.push(...loadAwsPrefixes(awsRaw));
    } catch (e) {
      console.warn("[cloudIpRanges] AWS falhou", e instanceof Error ? e.message : e);
    }
    try {
      const gcpRaw = await fetchJson(GCP_RANGES_URL);
      merged.push(...loadGcpPrefixes(gcpRaw));
    } catch (e) {
      console.warn("[cloudIpRanges] GCP falhou", e instanceof Error ? e.message : e);
    }
    /** Dedup por name+base+bits */
    const seen = new Set<string>();
    const unique: MutableRange[] = [];
    for (const n of merged) {
      const k = `${n.name}|${n.base}/${n.bits}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(n);
    }
    dynamicRanges = unique;
    lastRefreshAt = Date.now();
    console.info("[cloudIpRanges] atualizado", { count: unique.length });
  })();
  try {
    await refreshInflight;
    return { ok: true, count: dynamicRanges.length };
  } catch (e) {
    return {
      ok: false,
      count: dynamicRanges.length,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    refreshInflight = null;
  }
}

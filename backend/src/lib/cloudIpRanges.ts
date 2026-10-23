/**
 * Prefixos IPv4 de cloud (AWS / GCP) — só listas oficiais ou CIDRs confirmados.
 * Nada de blocos «à sorte» (Azure/Hetzner genéricos) para não marcar IPs residenciais.
 */
import type { DatacenterNetwork } from "./ipNetworkClass";

type MutableRange = DatacenterNetwork;

const AWS_RANGES_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json";
const GCP_RANGES_URL = "https://www.gstatic.com/ipranges/cloud.json";

/**
 * Bootstrap mínimo: só os CIDRs AWS que bateram nos IPs do relatório Visivra
 * (confirmados em ipinfo AS16509 Amazon). Removidos após 1.º refresh AWS OK.
 */
const BOOTSTRAP_CONFIRMED: MutableRange[] = [
  {
    name: "AWS",
    place: "us-west-1",
    country: "US",
    base: "18.144.0.0",
    bits: 15,
    source: "bootstrap_confirmed",
  },
  {
    name: "AWS",
    place: "us-west-1",
    country: "US",
    base: "52.52.0.0",
    bits: 15,
    source: "bootstrap_confirmed",
  },
  {
    name: "AWS",
    place: "us-west-1",
    country: "US",
    base: "54.67.0.0",
    bits: 16,
    source: "bootstrap_confirmed",
  },
];

let dynamicRanges: MutableRange[] = [...BOOTSTRAP_CONFIRMED];
let lastRefreshAt = 0;
let refreshInflight: Promise<void> | null = null;
let lastRefreshHadOfficial = false;

function parseCidr(cidr: string): { base: string; bits: number } | null {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!m) return null;
  const bits = Number(m[2]);
  /** Evitar prefixos demasiado largos (&lt; /12) vindos de feeds — menos falsos positivos. */
  if (!Number.isFinite(bits) || bits < 12 || bits > 32) return null;
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
    /**
     * EC2 = instâncias (bots típicos).
     * AMAZON = infra AWS publicada pela Amazon (inclui os CIDRs do relatório Visivra).
     * Não incluir CLOUDFRONT/S3 isolados — CDN de sites legítimos.
     */
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
      source: "aws_official",
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
      country: "US",
      base: cidr.base,
      bits: cidr.bits,
      source: "gcp_official",
    });
  }
  return out;
}

function dedupe(ranges: MutableRange[]): MutableRange[] {
  const seen = new Set<string>();
  const unique: MutableRange[] = [];
  for (const n of ranges) {
    const k = `${n.name}|${n.base}/${n.bits}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(n);
  }
  return unique;
}

/** Lista actual (bootstrap confirmado até ao 1.º refresh oficial). */
export function getCloudDatacenterNetworks(): readonly DatacenterNetwork[] {
  return dynamicRanges;
}

export function cloudIpRangesStatus(): {
  count: number;
  lastRefreshAt: number;
  official: boolean;
} {
  return { count: dynamicRanges.length, lastRefreshAt, official: lastRefreshHadOfficial };
}

/**
 * Descarrega listas públicas AWS + GCP.
 * Com sucesso: substitui o bootstrap (só evidência oficial).
 * Sem sucesso: mantém bootstrap confirmado Visivra.
 */
export async function refreshCloudIpRanges(): Promise<{ ok: boolean; count: number; error?: string }> {
  if (refreshInflight) {
    await refreshInflight;
    return { ok: true, count: dynamicRanges.length };
  }
  refreshInflight = (async () => {
    const aws: MutableRange[] = [];
    const gcp: MutableRange[] = [];
    try {
      const awsRaw = await fetchJson(AWS_RANGES_URL);
      aws.push(...loadAwsPrefixes(awsRaw));
    } catch (e) {
      console.warn("[cloudIpRanges] AWS falhou", e instanceof Error ? e.message : e);
    }
    try {
      const gcpRaw = await fetchJson(GCP_RANGES_URL);
      gcp.push(...loadGcpPrefixes(gcpRaw));
    } catch (e) {
      console.warn("[cloudIpRanges] GCP falhou", e instanceof Error ? e.message : e);
    }
    if (aws.length > 0 || gcp.length > 0) {
      dynamicRanges = dedupe([...aws, ...gcp]);
      lastRefreshHadOfficial = true;
    } else {
      dynamicRanges = [...BOOTSTRAP_CONFIRMED];
      lastRefreshHadOfficial = false;
    }
    lastRefreshAt = Date.now();
    console.info("[cloudIpRanges] atualizado", {
      count: dynamicRanges.length,
      official: lastRefreshHadOfficial,
      aws: aws.length,
      gcp: gcp.length,
    });
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

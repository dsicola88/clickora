import { lookup } from "node:dns/promises";
import net from "node:net";

/** Mensagem para o cliente. Não inclui o IP resolvido. */
export const PRESELL_IMPORT_BLOCKED_MESSAGE =
  "Não use localhost nem endereços internos — cole o link público da página do produto.";

export class PresellImportBlockedError extends Error {
  constructor(message = PRESELL_IMPORT_BLOCKED_MESSAGE) {
    super(message);
    this.name = "PresellImportBlockedError";
  }
}

export const IMPORT_MAX_REDIRECTS = 5;
export const IMPORT_MAX_HTML_BYTES = 2_000_000;

const BLOCKED_NAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "metadata.aws.internal",
  "instance-data",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

export function isBlockedIpAddress(raw: string): boolean {
  const ip = raw.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] || "";
  if (!ip) return true;
  if (net.isIP(ip) === 4 || /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return isBlockedIpv4(ip);
  return isBlockedIpv6(ip);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = ((value << 8) | n) >>> 0;
  }
  return value;
}

function inPrefix(ip: number, base: number, bits: number): boolean {
  if (bits <= 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (base >>> 0 & mask);
}

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value == null) return true;
  const cidrs: Array<[number, number]> = [
    [0x00000000, 8],
    [0x0a000000, 8],
    [0x64400000, 10],
    [0x7f000000, 8],
    [0xa9fe0000, 16],
    [0xac100000, 12],
    [0xc0000000, 24],
    [0xc0000200, 24],
    [0xc0a80000, 16],
    [0xc6120000, 15],
    [0xc6336400, 24],
    [0xcb007100, 24],
    [0xe0000000, 4],
    [0xf0000000, 4],
  ];
  return cidrs.some(([base, bits]) => inPrefix(value, base, bits));
}

function expandIpv6(input: string): number[] | null {
  let text = input.toLowerCase().split("%")[0] || "";
  const dotted = text.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const v4 = ipv4ToInt(dotted[2] || "");
    if (v4 == null) return null;
    const hi = (v4 >>> 16) & 0xffff;
    const lo = v4 & 0xffff;
    text = `${dotted[1]}${hi.toString(16)}:${lo.toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  const parts = halves.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (parts.length !== 8) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part) && part !== "0" && part !== "") return null;
    if (part === "") return null;
    nums.push(Number.parseInt(part, 16));
  }
  return nums;
}

function hextetIpv4(hi: number, lo: number): string {
  return `${(hi >>> 8) & 0xff}.${hi & 0xff}.${(lo >>> 8) & 0xff}.${lo & 0xff}`;
}

function isBlockedIpv6(ip: string): boolean {
  const parts = expandIpv6(ip);
  if (!parts) return true;
  const [a, b, c, d, e, f, g, h] = parts;
  if (parts.every((n) => n === 0)) return true;
  if (parts.slice(0, 7).every((n) => n === 0) && h === 1) return true;
  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff) {
    return isBlockedIpv4(hextetIpv4(g!, h!));
  }
  if (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) {
    return isBlockedIpv4(hextetIpv4(g!, h!));
  }
  if (a === 0x2002) return isBlockedIpv4(hextetIpv4(b!, c!));
  if ((a & 0xfe00) === 0xfc00) return true;
  if ((a & 0xffc0) === 0xfe80) return true;
  if ((a & 0xffc0) === 0xfec0) return true;
  if ((a & 0xff00) === 0xff00) return true;
  if (a === 0x2001 && b === 0x0db8) return true;
  if (a === 0x2001 && b === 0) return true;
  if (a === 0x0100 && b === 0 && c === 0 && d === 0) return true;
  if (a === 0x2001 && (b & 0xfff0) === 0x0010) return true;
  if (a === 0x2001 && (b & 0xfff0) === 0x0020) return true;
  return false;
}

function hostnameIsObfuscatedIp(hostname: string): boolean {
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) return true;
  if (/^(0x[0-9a-f]+)(\.0x[0-9a-f]+){0,3}$/i.test(hostname)) return true;
  const dotted = hostname.split(".");
  if (dotted.length === 4 && dotted.every((p) => /^\d+$/.test(p))) {
    if (dotted.some((p) => p.length > 1 && p.startsWith("0"))) return true;
  }
  return false;
}

/** Bloqueia nomes internos. Endereços IP passam por `isBlockedIpAddress`. */
export function isBlockedPresellImportHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!h || h.includes("%")) return true;
  if (
    BLOCKED_NAMES.has(h) ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localdomain")
  ) {
    return true;
  }
  if (hostnameIsObfuscatedIp(h)) return true;
  if (net.isIP(h) || h.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isBlockedIpAddress(h);
  return false;
}

export function assertExternalProductUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new PresellImportBlockedError("URL inválido.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PresellImportBlockedError("Use um link que comece com https://");
  }
  if (parsed.username || parsed.password) {
    throw new PresellImportBlockedError("URL inválido para importação.");
  }
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  if (!Number.isInteger(port) || (port !== 80 && port !== 443)) {
    throw new PresellImportBlockedError("Porta não permitida na importação. Use o link https padrão da página.");
  }
  if (isBlockedPresellImportHost(parsed.hostname)) {
    throw new PresellImportBlockedError();
  }
  return parsed;
}

export async function resolveImportAddresses(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) return [hostname];
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function vetImportUrl(
  raw: string,
  resolve: (hostname: string) => Promise<string[]> = resolveImportAddresses,
): Promise<{ url: URL; addresses: string[] }> {
  const url = assertExternalProductUrl(raw);
  let addresses: string[];
  try {
    addresses = await resolve(url.hostname);
  } catch (error) {
    if (error instanceof PresellImportBlockedError) throw error;
    throw new PresellImportBlockedError("Não foi possível resolver o endereço da página.");
  }
  if (addresses.length === 0) {
    throw new PresellImportBlockedError("Não foi possível resolver o endereço da página.");
  }
  for (const address of addresses) {
    if (!net.isIP(address) || isBlockedIpAddress(address)) {
      throw new PresellImportBlockedError();
    }
  }
  return { url, addresses };
}

/**
 * Blocos IPv4 da Fastly (AS54113) em 12/10/2026.
 * Os primeiros vêm de https://api.fastly.com/public-ip-list.
 * 146.75.128.0/17 está anunciado pela AS54113 e não vinha nessa lista;
 * é onde cai 146.75.146.1. A GeoLite marca o nó como SE e o registo RIPE
 * como Los Angeles. Nenhum dos dois é o país de quem clicou.
 */
const FASTLY_PREFIXES: ReadonlyArray<readonly [string, number]> = [
  ["23.235.32.0", 20],
  ["43.249.72.0", 22],
  ["103.244.50.0", 24],
  ["103.245.222.0", 23],
  ["103.245.224.0", 24],
  ["104.156.80.0", 20],
  ["140.248.64.0", 18],
  ["140.248.128.0", 17],
  ["146.75.0.0", 17],
  ["146.75.128.0", 17],
  ["151.101.0.0", 16],
  ["157.52.64.0", 18],
  ["167.82.0.0", 17],
  ["167.82.128.0", 20],
  ["167.82.160.0", 20],
  ["167.82.224.0", 20],
  ["172.111.64.0", 18],
  ["185.31.16.0", 22],
  ["199.27.72.0", 21],
  ["199.232.0.0", 16],
];

function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim().replace(/^::ffff:/i, ""));
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((n) => n > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function inPrefix(ip: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base);
  if (b == null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (b & mask);
}

/** IP de um nó Fastly. Não é o endereço de quem clicou. */
export function isFastlyEdgeIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const n = ipv4ToInt(ip);
  if (n == null) return false;
  return FASTLY_PREFIXES.some(([base, bits]) => inPrefix(n, base, bits));
}

/** Intervalos [início, fim] inclusivos, para o relatório não usar o país gravado do nó. */
export function fastlyPrefixBounds(): Array<readonly [number, number]> {
  return FASTLY_PREFIXES.map(([base, bits]) => {
    const start = ipv4ToInt(base);
    if (start == null) return null;
    const size = 2 ** (32 - bits);
    return [start, (start + size - 1) >>> 0] as const;
  }).filter((row): row is readonly [number, number] => row != null);
}

/** Alinha IP do cliente com o guardado na blacklist (IPv4 mapeado em IPv6). */
export function normalizeIpForMatch(ip: string): string {
  const t = ip.trim();
  if (t.startsWith("::ffff:") && t.includes(".")) return t.slice(7);
  return t;
}

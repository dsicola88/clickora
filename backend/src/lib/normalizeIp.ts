/** Alinha IP do cliente com o guardado na blacklist (IPv4 mapeado em IPv6). */
export function normalizeIpForMatch(ip: string): string {
  let t = ip.trim().toLowerCase();
  if (t.startsWith("::ffff:") && t.includes(".")) t = t.slice(7);
  return t;
}

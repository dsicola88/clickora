/** Contagem usada pelo Google Ads e pelo Microsoft Advertising.
 * Caracteres de largura dupla (CJK e emoji) contam como 2.
 * Fontes: Google Ads Help 7684791; Microsoft Advertising entity limits (Bing Ads v13).
 */
const DOUBLE_WIDTH =
  /[\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u;

export function adTextLength(value: string): number {
  let n = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    n += DOUBLE_WIDTH.test(ch) || cp > 0xffff ? 2 : 1;
  }
  return n;
}

export function normalizeAdText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function pathToken(value: string, max: number): string {
  const raw = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, max);
  return raw;
}

/** "CelluCare CelluCare" é o mesmo nome escrito duas vezes. Fica um. */
export function canonicalProductName(raw: string): string {
  const words = normalizeAdText(raw).split(" ").filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const left = words.slice(0, half).join(" ");
    const right = words.slice(half).join(" ");
    if (left.toLowerCase() === right.toLowerCase()) return canonicalProductName(left);
  }
  return words.join(" ");
}

/**
 * Caminho do anúncio: o nome inteiro se couber em 15.
 * Se não couber, a primeira palavra. Nunca corta uma palavra a meio.
 */
export function adPath(value: string, max: number): string {
  const name = canonicalProductName(value);
  const compact = pathToken(name, 80);
  if (compact.length >= 2 && compact.length <= max) return compact;
  const first = name.split(" ")[0] ?? "";
  const token = pathToken(first, 80);
  if (token.length >= 2 && token.length <= max) return token;
  return "";
}

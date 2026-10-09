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

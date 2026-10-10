/** Abaixo disto um operador móvel inteiro pode cair na lista. 0 = desligado. */
export const AUTO_BLACKLIST_MIN_CLICKS = 30;

export function effectiveAutoBlacklistThreshold(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const n = Math.floor(raw);
  if (n < AUTO_BLACKLIST_MIN_CLICKS) return AUTO_BLACKLIST_MIN_CLICKS;
  return Math.min(5000, n);
}

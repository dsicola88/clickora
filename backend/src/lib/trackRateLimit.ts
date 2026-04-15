/**
 * Limite mole por IP em memória (anti-spam / burst) — não substitui WAF/CDN.
 * Variáveis: TRACK_RATE_LIMIT_MAX (default 240), TRACK_RATE_LIMIT_WINDOW_MS (default 60000).
 */
const MAX = Math.max(30, Number(process.env.TRACK_RATE_LIMIT_MAX ?? 240));
const WINDOW_MS = Math.max(5_000, Number(process.env.TRACK_RATE_LIMIT_WINDOW_MS ?? 60_000));

type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();
let pruneTick = 0;

export function consumeTrackRateLimit(ip: string): boolean {
  const key = ip?.trim() ? `ip:${normalizeKey(ip)}` : "ip:unknown";
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.n += 1;
  if (b.n > MAX) return false;

  if (++pruneTick % 3000 === 0) {
    for (const [k, v] of buckets) {
      if (now > v.reset + WINDOW_MS) buckets.delete(k);
    }
  }
  return true;
}

function normalizeKey(ip: string): string {
  const t = ip.trim();
  if (t.startsWith("::ffff:")) return t.slice(7);
  return t;
}

/**
 * Rate limit de track por IP.
 * - Sem REDIS_URL: Map em memória (1 processo).
 * - Com REDIS_URL: INCR + PEXPIRE partilhado entre réplicas.
 * Fail-open se Redis falhar (não derrubar ads pagos por outage de cache).
 *
 * Env: TRACK_RATE_LIMIT_MAX (default 240), TRACK_RATE_LIMIT_WINDOW_MS (default 60000), REDIS_URL.
 */
import Redis from "ioredis";

const MAX = Math.max(30, Number(process.env.TRACK_RATE_LIMIT_MAX ?? 240));
const WINDOW_MS = Math.max(5_000, Number(process.env.TRACK_RATE_LIMIT_WINDOW_MS ?? 60_000));

type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();
let pruneTick = 0;

let redis: Redis | null | undefined;
let redisWarned = false;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = (process.env.REDIS_URL || "").trim();
  if (!url) {
    redis = null;
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      if (!redisWarned) {
        redisWarned = true;
        console.warn("[trackRateLimit] Redis error — a usar fail-open / memória:", err.message);
      }
    });
    return redis;
  } catch (e) {
    console.warn(
      "[trackRateLimit] REDIS_URL inválido — limite só em memória:",
      e instanceof Error ? e.message : e,
    );
    redis = null;
    return null;
  }
}

function normalizeKey(ip: string): string {
  const t = ip.trim();
  if (t.startsWith("::ffff:")) return t.slice(7);
  return t;
}

function consumeMemory(ip: string): boolean {
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

/** INCR + PEXPIRE atómicos; repara chaves órfãs sem TTL (deploy pré-Lua). */
const REDIS_INCR_EXPIRE_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
elseif redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return n
`;

async function consumeRedis(ip: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return consumeMemory(ip);

  const key = `track:rl:${ip?.trim() ? normalizeKey(ip) : "unknown"}`;
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const n = Number(await client.eval(REDIS_INCR_EXPIRE_LUA, 1, key, String(WINDOW_MS)));
    return n <= MAX;
  } catch (e) {
    if (!redisWarned) {
      redisWarned = true;
      console.warn(
        "[trackRateLimit] Redis indisponível — fail-open com memória:",
        e instanceof Error ? e.message : e,
      );
    }
    return consumeMemory(ip);
  }
}

/** Sync API (compat): só memória. Preferir `consumeTrackRateLimitAsync` no hot path. */
export function consumeTrackRateLimit(ip: string): boolean {
  return consumeMemory(ip);
}

export async function consumeTrackRateLimitAsync(ip: string): Promise<boolean> {
  if (getRedis()) return consumeRedis(ip);
  return consumeMemory(ip);
}

/** Test helpers */
export function __resetTrackRateLimitForTests(): void {
  buckets.clear();
  pruneTick = 0;
}

export function __trackRateLimitConfigForTests(): { max: number; windowMs: number; hasRedis: boolean } {
  return { max: MAX, windowMs: WINDOW_MS, hasRedis: Boolean(getRedis()) };
}

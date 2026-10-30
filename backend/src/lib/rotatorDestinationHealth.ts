/**
 * Probe rápida SSRF-consciente para contingência de rotadores.
 * Cache TTL evita latência Voluum-grade (não sonda em todos os cliques).
 */

const DEFAULT_TIMEOUT_MS = 1_200;
const DEFAULT_CACHE_TTL_MS = 60_000;

type CacheEntry = { healthy: boolean; status: number | null; reason?: string; expiresAt: number };

const healthCache = new Map<string, CacheEntry>();

/** Destinos onde HTTP probe não faz sentido (apps de chat / deep links). */
const SKIP_PROBE_HOST_SUFFIXES = [
  "wa.me",
  "api.whatsapp.com",
  "web.whatsapp.com",
  "chat.whatsapp.com",
  "t.me",
  "telegram.me",
  "m.me",
  "messenger.com",
  "lin.ee",
  "line.me",
] as const;

export function rotatorDestinationProbeEnabled(): boolean {
  const raw = (process.env.ROTATOR_DESTINATION_PROBE || "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function cacheTtlMs(): number {
  const n = Number(process.env.ROTATOR_DESTINATION_PROBE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  return Number.isFinite(n) && n >= 0 ? Math.min(600_000, n) : DEFAULT_CACHE_TTL_MS;
}

/** Se true, 404/410/451 também disparam failover (mais agressivo). Default: só 5xx/rede/timeout. */
export function rotatorFailOnNotFound(): boolean {
  const raw = (process.env.ROTATOR_PROBE_FAIL_ON_404 || "0").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

export function isRotatorDestinationProbeable(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^(10\.|192\.168\.|169\.254\.|127\.)/.test(host)
  ) {
    return false;
  }
  return !SKIP_PROBE_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

export function clearRotatorDestinationHealthCache(): void {
  healthCache.clear();
}

/**
 * HEAD rápido; se o servidor não permitir HEAD, tenta GET com Range.
 * Saudável por defeito: 2xx/3xx/4xx (excepto 404/410/451 se ROTATOR_PROBE_FAIL_ON_404=1).
 * Unhealthy: 5xx, timeout, rede.
 */
export async function probeRotatorDestinationQuick(
  rawUrl: string,
  opts?: { timeoutMs?: number; fetchImpl?: typeof fetch; bypassCache?: boolean },
): Promise<{ healthy: boolean; status: number | null; reason?: string; fromCache?: boolean }> {
  if (!isRotatorDestinationProbeable(rawUrl)) {
    return { healthy: true, status: null, reason: "skipped_host" };
  }

  const key = rawUrl.trim();
  const now = Date.now();
  if (!opts?.bypassCache) {
    const hit = healthCache.get(key);
    if (hit && hit.expiresAt > now) {
      return { healthy: hit.healthy, status: hit.status, reason: hit.reason, fromCache: true };
    }
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts?.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let result: { healthy: boolean; status: number | null; reason?: string };
  try {
    let res = await doFetch(key, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ClickoraRotatorHealth/1.0 (+https://dclickora.com; failover check)",
        Accept: "*/*",
      },
    });
    if (res.status === 405 || res.status === 501) {
      res = await doFetch(key, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "User-Agent": "ClickoraRotatorHealth/1.0 (+https://dclickora.com; failover check)",
          Accept: "text/html,*/*;q=0.8",
          Range: "bytes=0-0",
        },
      });
    }
    const status = res.status;
    if (status >= 200 && status < 400) {
      result = { healthy: true, status };
    } else if (status >= 500) {
      result = { healthy: false, status, reason: "upstream_5xx" };
    } else if (rotatorFailOnNotFound() && (status === 404 || status === 410 || status === 451)) {
      result = { healthy: false, status, reason: `http_${status}` };
    } else {
      // 4xx (incl. 404): página pode existir / bloquear bots — não matar A/B por defeito
      result = { healthy: true, status, reason: "client_4xx_assumed_reachable" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network";
    const aborted = e instanceof Error && (e.name === "AbortError" || /aborted|timeout/i.test(msg));
    result = { healthy: false, status: null, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }

  const ttl = cacheTtlMs();
  if (ttl > 0) {
    healthCache.set(key, { ...result, expiresAt: now + ttl });
  }
  return result;
}

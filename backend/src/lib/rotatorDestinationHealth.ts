/**
 * Probe rápida SSRF-safe para contingência de rotadores.
 * Mesmo padrão que destinationProbe / import: vet URL + DNS + pin de IP por hop.
 * Cache TTL evita latência Voluum-grade (não sonda em todos os cliques).
 */
import { IMPORT_MAX_REDIRECTS, PresellImportBlockedError, vetImportUrl } from "./presellImportSsrf";
import { nodeImportRequest } from "./presellSafeFetch";

const DEFAULT_TIMEOUT_MS = 1_200;
const DEFAULT_CACHE_TTL_MS = 60_000;
const PROBE_MAX_BODY_BYTES = 2_048;

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

function classifyStatus(status: number): { healthy: boolean; status: number | null; reason?: string } {
  if (status >= 200 && status < 400) {
    return { healthy: true, status };
  }
  if (status >= 500) {
    return { healthy: false, status, reason: "upstream_5xx" };
  }
  if (rotatorFailOnNotFound() && (status === 404 || status === 410 || status === 451)) {
    return { healthy: false, status, reason: `http_${status}` };
  }
  // 4xx (incl. 404): página pode existir / bloquear bots — não matar A/B por defeito
  return { healthy: true, status, reason: "client_4xx_assumed_reachable" };
}

function headerLocation(headers: Record<string, unknown> | NodeJS.Dict<string | string[] | undefined>): string {
  const value = headers.location ?? headers.Location;
  if (Array.isArray(value)) return String(value[0] || "");
  return typeof value === "string" ? value : "";
}

/**
 * HEAD rápido via fetchImpl (testes); produção usa GET+Range com pin de IP.
 * Saudável por defeito: 2xx/3xx/4xx (excepto 404/410/451 se ROTATOR_PROBE_FAIL_ON_404=1).
 * Unhealthy: 5xx, timeout, rede, SSRF.
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
  let result: { healthy: boolean; status: number | null; reason?: string };

  if (opts?.fetchImpl) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const doFetch = opts.fetchImpl;
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
      result = classifyStatus(res.status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network";
      const aborted = e instanceof Error && (e.name === "AbortError" || /aborted|timeout/i.test(msg));
      result = { healthy: false, status: null, reason: aborted ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  } else {
    try {
      let current = key;
      const signal = AbortSignal.timeout(timeoutMs);
      let status = 0;
      for (let hop = 0; hop <= IMPORT_MAX_REDIRECTS; hop++) {
        const vetted = await vetImportUrl(current);
        const exchange = await nodeImportRequest({
          url: vetted.url,
          addresses: vetted.addresses,
          signal,
          maxBytes: PROBE_MAX_BODY_BYTES,
          headers: {
            "User-Agent": "ClickoraRotatorHealth/1.0 (+https://dclickora.com; failover check)",
            Accept: "text/html,*/*;q=0.8",
            Range: `bytes=0-${PROBE_MAX_BODY_BYTES - 1}`,
          },
        });
        status = exchange.status;
        if (status >= 300 && status < 400) {
          const loc = headerLocation(exchange.headers);
          if (!loc || hop === IMPORT_MAX_REDIRECTS) break;
          current = new URL(loc, vetted.url).href;
          continue;
        }
        break;
      }
      result = classifyStatus(status || 0);
    } catch (e) {
      if (e instanceof PresellImportBlockedError) {
        result = { healthy: false, status: null, reason: "ssrf_blocked" };
      } else {
        const msg = e instanceof Error ? e.message : "network";
        const aborted =
          e instanceof Error &&
          (e.name === "AbortError" || e.name === "TimeoutError" || /aborted|timeout/i.test(msg));
        result = { healthy: false, status: null, reason: aborted ? "timeout" : "network" };
      }
    }
  }

  const ttl = cacheTtlMs();
  if (ttl > 0) {
    healthCache.set(key, { ...result, expiresAt: now + ttl });
  }
  return result;
}

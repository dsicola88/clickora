/**
 * Probe rápida SSRF-consciente para contingência de rotadores.
 * Não substitui a probe de compliance (mais pesada); só decide failover → backup/outro braço.
 */

const DEFAULT_TIMEOUT_MS = 1_500;

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

/**
 * HEAD rápido; se o servidor não permitir HEAD, tenta GET com Range.
 * Considera saudável: 2xx/3xx. 4xx/5xx/timeout/rede → unhealthy.
 */
export async function probeRotatorDestinationQuick(
  rawUrl: string,
  opts?: { timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<{ healthy: boolean; status: number | null; reason?: string }> {
  if (!isRotatorDestinationProbeable(rawUrl)) {
    return { healthy: true, status: null, reason: "skipped_host" };
  }
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts?.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await doFetch(rawUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ClickoraRotatorHealth/1.0 (+https://dclickora.com; failover check)",
        Accept: "*/*",
      },
    });
    if (res.status === 405 || res.status === 501) {
      res = await doFetch(rawUrl, {
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
    if (status >= 200 && status < 400) return { healthy: true, status };
    if (status >= 500) return { healthy: false, status, reason: "upstream_5xx" };
    // 4xx: página pode existir mas bloquear bots — não forçar backup agressivo excepto 404/410/451
    if (status === 404 || status === 410 || status === 451) {
      return { healthy: false, status, reason: `http_${status}` };
    }
    return { healthy: true, status, reason: "client_4xx_assumed_reachable" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network";
    const aborted = e instanceof Error && (e.name === "AbortError" || /aborted|timeout/i.test(msg));
    return { healthy: false, status: null, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

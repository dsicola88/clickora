import {
  IMPORT_MAX_REDIRECTS,
  PresellImportBlockedError,
  assertExternalProductUrl,
  isBlockedIpAddress,
} from "../lib/presellImportSsrf";
import { lookup } from "node:dns/promises";
import type { DestinationProbeResult } from "./types";

const PROBE_TIMEOUT_MS = 8_000;
/** Limite de corpo na probe — evita esgotar memória com respostas enormes. */
const PROBE_MAX_BODY_BYTES = 512_000;
const PROBE_UA =
  "ClickoraComplianceBot/1.0 (+https://dclickora.com; internal ads destination check; not Google AdsBot)";

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function registrableLike(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

/**
 * Probe SSRF-safe do destino da oferta.
 * Não executa JavaScript da página. Valida DNS e cada hop de redirect.
 */
export async function probeDestinationUrl(rawUrl: string | null | undefined): Promise<DestinationProbeResult> {
  const empty: DestinationProbeResult = {
    attempted: false,
    ok: false,
    https: null,
    statusCode: null,
    finalUrl: null,
    redirectCount: 0,
    redirectCycle: false,
    openRedirectSuspect: false,
    domainChanged: false,
    initialHost: null,
    finalHost: null,
    crawlerBlocked: false,
    hops: [],
  };

  if (!rawUrl || !rawUrl.trim()) {
    return empty;
  }

  const openRedirectSuspect = /[?&](redirect|url|next|return|dest|destination|continue)=https?:\/\//i.test(
    rawUrl,
  );

  let current: string;
  try {
    current = assertExternalProductUrl(rawUrl.trim()).toString();
  } catch (e) {
    const ssrf = e instanceof PresellImportBlockedError;
    return {
      ...empty,
      attempted: true,
      openRedirectSuspect,
      errorCode: ssrf ? "ssrf_blocked" : "invalid_url",
      errorMessage: e instanceof Error ? e.message : "invalid_url",
    };
  }

  const initialHost = hostOf(current);
  const hops: string[] = [current];
  const seen = new Set<string>([current]);
  let redirectCount = 0;
  let redirectCycle = false;
  let statusCode: number | null = null;
  let crawlerBlocked = false;

  try {
    for (let i = 0; i <= IMPORT_MAX_REDIRECTS; i++) {
      const u = new URL(current);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return {
          attempted: true,
          ok: false,
          https: false,
          statusCode: null,
          finalUrl: current,
          redirectCount,
          redirectCycle,
          openRedirectSuspect,
          domainChanged: false,
          initialHost,
          finalHost: hostOf(current),
          crawlerBlocked,
          errorCode: "invalid_url",
          hops,
        };
      }

      // Revalidar host + DNS em cada hop (mitiga DNS rebinding / redirect para privado).
      assertExternalProductUrl(current);
      const records = await lookup(u.hostname, { all: true, verbatim: true });
      for (const rec of records) {
        if (isBlockedIpAddress(rec.address)) {
          throw new PresellImportBlockedError();
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": PROBE_UA,
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            Range: `bytes=0-${PROBE_MAX_BODY_BYTES - 1}`,
          },
        });
      } finally {
        clearTimeout(timer);
      }

      statusCode = res.status;
      const declared = Number(res.headers.get("content-length") || "0");
      if (Number.isFinite(declared) && declared > PROBE_MAX_BODY_BYTES * 4) {
        // Resposta declaradamente enorme: não consumir o corpo; tratar como verificável só ao nível HTTP.
        try {
          res.body?.cancel();
        } catch {
          /* ignore */
        }
      } else if (res.body && statusCode >= 200 && statusCode < 300) {
        // Consumir no máximo PROBE_MAX_BODY_BYTES e descartar o resto.
        const reader = res.body.getReader();
        let read = 0;
        while (read < PROBE_MAX_BODY_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          read += value?.byteLength ?? 0;
          if (read >= PROBE_MAX_BODY_BYTES) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            break;
          }
        }
      }
      if (statusCode === 403 || statusCode === 401) {
        const server = (res.headers.get("server") || "").toLowerCase();
        if (server.includes("cloudflare") || server.includes("akamai")) {
          crawlerBlocked = true;
        }
      }

      if (statusCode >= 300 && statusCode < 400) {
        try {
          res.body?.cancel();
        } catch {
          /* ignore */
        }
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current).toString();
        redirectCount += 1;
        if (seen.has(next)) {
          redirectCycle = true;
          hops.push(next);
          break;
        }
        assertExternalProductUrl(next);
        seen.add(next);
        hops.push(next);
        current = next;
        if (redirectCount > IMPORT_MAX_REDIRECTS) {
          return {
            attempted: true,
            ok: false,
            https: current.startsWith("https:"),
            statusCode,
            finalUrl: current,
            redirectCount,
            redirectCycle,
            openRedirectSuspect,
            domainChanged:
              Boolean(initialHost && hostOf(current)) &&
              registrableLike(initialHost!) !== registrableLike(hostOf(current)!),
            initialHost,
            finalHost: hostOf(current),
            crawlerBlocked,
            errorCode: "redirect_limit",
            hops,
          };
        }
        continue;
      }

      break;
    }
  } catch (e) {
    if (e instanceof PresellImportBlockedError) {
      return {
        attempted: true,
        ok: false,
        https: null,
        statusCode,
        finalUrl: current,
        redirectCount,
        redirectCycle,
        openRedirectSuspect,
        domainChanged: false,
        initialHost,
        finalHost: hostOf(current),
        crawlerBlocked,
        errorCode: "ssrf_blocked",
        errorMessage: e.message,
        hops,
      };
    }
    const name = e instanceof Error ? e.name : "";
    return {
      attempted: true,
      ok: false,
      https: current.startsWith("https:"),
      statusCode,
      finalUrl: current,
      redirectCount,
      redirectCycle,
      openRedirectSuspect,
      domainChanged: false,
      initialHost,
      finalHost: hostOf(current),
      crawlerBlocked,
      errorCode: name === "AbortError" ? "timeout" : "network",
      errorMessage: e instanceof Error ? e.message : "network",
      hops,
    };
  }

  const finalHost = hostOf(current);
  const domainChanged = Boolean(
    initialHost && finalHost && registrableLike(initialHost) !== registrableLike(finalHost),
  );
  const ok = !redirectCycle && statusCode != null && statusCode >= 200 && statusCode < 400;

  return {
    attempted: true,
    ok,
    https: current.startsWith("https:"),
    statusCode,
    finalUrl: current,
    redirectCount,
    redirectCycle,
    openRedirectSuspect,
    domainChanged,
    initialHost,
    finalHost,
    crawlerBlocked,
    hops,
  };
}

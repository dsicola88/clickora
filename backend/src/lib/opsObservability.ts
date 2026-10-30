/**
 * Observabilidade enterprise: request-id, janela deslizante 5xx, alertas por tipo,
 * amostras de latência por endpoint, event-loop lag, Sentry opcional.
 * SENTRY_DSN / OPS_ALERT_WEBHOOK_URL via env — sem DSN o Sentry fica no-op.
 * Sem PII / tokens / passwords nos logs.
 */
import { monitorEventLoopDelay, PerformanceObserver, type IntervalHistogram } from "node:perf_hooks";
import { freemem, totalmem, cpus } from "node:os";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getCreateStageSnapshot } from "./createStageMetrics";
import { getComplianceJobQueueSnapshot } from "./complianceJobs";
import {
  isEmbeddedComplianceWorkerConfigured,
  isEmbeddedComplianceWorkerRunning,
} from "./complianceWorkerEmbedded";
import { evaluateComplianceQueueAlerts, sendOpsAlert } from "./opsOperationalAlerts";

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, hint?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
};

let sentry: SentryLike | null = null;
let sentryTried = false;

const counters = {
  requests: 0,
  errors5xx: 0,
  unattributedSales: 0,
  startedAt: Date.now(),
};

/** Timestamps de 5xx na janela (ms). */
const errors5xxWindow: number[] = [];
const ERROR_WINDOW_MS = 5 * 60 * 1000;
/** Disparar alerta se ≥ N erros 5xx na janela. */
const ERROR_BURST_THRESHOLD = Math.max(1, Number(process.env.OPS_5XX_BURST_THRESHOLD || "5") || 5);

/** Cooldown por tipo de alerta (não um global único). */
const lastAlertByKind = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

/** Ring buffer de latências do redirect /track/r (ms). */
const TRACK_LATENCY_CAP = 200;
const trackRedirectLatenciesMs: number[] = [];

/** Latências por rota normalizada (máx. N amostras por chave). */
const ENDPOINT_LATENCY_CAP = 120;
const endpointLatencies = new Map<string, number[]>();
const endpointErrors = new Map<string, number>();
const SLOW_QUERY_MS = Math.max(200, Number(process.env.OPS_SLOW_REQUEST_MS || "2000") || 2000);
const slowRequestsRecent: Array<{ route: string; ms: number; at: number }> = [];
const SLOW_CAP = 40;

let eld: IntervalHistogram | null = null;
try {
  eld = monitorEventLoopDelay({ resolution: 20 });
  eld.enable();
} catch {
  eld = null;
}

/** GC major/minor durations (ms) — ring buffer. */
const GC_CAP = 80;
const gcDurationsMs: number[] = [];
let gcCount = 0;
let gcTotalMs = 0;
try {
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const ms = e.duration;
      if (!Number.isFinite(ms)) continue;
      gcCount += 1;
      gcTotalMs += ms;
      gcDurationsMs.push(Math.round(ms));
      while (gcDurationsMs.length > GC_CAP) gcDurationsMs.shift();
    }
  });
  obs.observe({ entryTypes: ["gc"], buffered: false });
} catch {
  /* GC observer indisponível em alguns runtimes */
}

/** Amostras de memória do processo (para fugas / crescimento). */
const MEM_SAMPLE_CAP = 60;
const memSamples: Array<{ at: number; rss_mb: number; heap_used_mb: number; external_mb: number }> = [];

export function sampleProcessMemory(label?: string): void {
  const mem = process.memoryUsage();
  memSamples.push({
    at: Date.now(),
    rss_mb: Number((mem.rss / 1024 / 1024).toFixed(1)),
    heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
    external_mb: Number((mem.external / 1024 / 1024).toFixed(1)),
  });
  while (memSamples.length > MEM_SAMPLE_CAP) memSamples.shift();
  if (label && process.env.OPS_MEM_LOG === "1") {
    const last = memSamples[memSamples.length - 1]!;
    console.info("[ops.mem]", label, last);
  }
}

setInterval(() => sampleProcessMemory(), 15_000).unref();

/** Snapshot assíncrono da fila PG — cacheado para /api/health síncrono. */
let complianceQueueCache: Record<string, unknown> = { status: "warming" };
async function refreshComplianceQueueCache(): Promise<void> {
  try {
    complianceQueueCache = await getComplianceJobQueueSnapshot();
    void evaluateComplianceQueueAlerts(complianceQueueCache as Record<string, unknown>).catch(() => undefined);
  } catch (e) {
    complianceQueueCache = {
      status: "error",
      message: e instanceof Error ? e.message : "error",
    };
  }
}
setInterval(() => {
  void refreshComplianceQueueCache();
}, 10_000).unref();
void refreshComplianceQueueCache();

async function loadSentry(): Promise<SentryLike | null> {
  if (sentryTried) return sentry;
  sentryTried = true;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  try {
    const mod = (await import("@sentry/node")) as unknown as SentryLike;
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.05"),
    });
    sentry = mod;
    console.info("[ops] Sentry inicializado");
    return sentry;
  } catch (e) {
    console.warn("[ops] Sentry indisponível:", (e as Error)?.message || e);
    return null;
  }
}

export function initOpsObservability(): void {
  void loadSentry();
}

function pruneErrorWindow(now = Date.now()): void {
  while (errors5xxWindow.length && now - errors5xxWindow[0]! > ERROR_WINDOW_MS) {
    errors5xxWindow.shift();
  }
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx] ?? null;
}

function latencyStats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50_ms: percentile(sorted, 50),
    p95_ms: percentile(sorted, 95),
    p99_ms: percentile(sorted, 99),
  };
}

/** Normaliza path para métricas (sem UUIDs / ids longos). */
export function normalizeRoutePath(method: string, path: string): string {
  const cleaned = String(path || "")
    .split("?")[0]!
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id",
    )
    .replace(/\/\d{4,}(?=\/|$)/g, "/:id");
  return `${method.toUpperCase()} ${cleaned}`;
}

function pushSample(map: Map<string, number[]>, key: string, ms: number, cap: number): void {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(Math.round(ms));
  while (arr.length > cap) arr.shift();
}

/** Regista latência do hop /track/r → oferta (amostra in-process). */
export function recordTrackRedirectLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  trackRedirectLatenciesMs.push(Math.round(ms));
  while (trackRedirectLatenciesMs.length > TRACK_LATENCY_CAP) {
    trackRedirectLatenciesMs.shift();
  }
}

/** Regista latência de operação externa (sem PII). */
export function recordExternalOpLatency(op: string, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  pushSample(endpointLatencies, `ext:${op}`, ms, ENDPOINT_LATENCY_CAP);
}

export function getOpsSnapshot() {
  pruneErrorWindow();
  const track = latencyStats(trackRedirectLatenciesMs);

  const endpoints: Record<string, ReturnType<typeof latencyStats> & { errors?: number }> = {};
  for (const [k, samples] of endpointLatencies) {
    endpoints[k] = { ...latencyStats(samples), errors: endpointErrors.get(k) || 0 };
  }
  for (const [k, n] of endpointErrors) {
    if (!endpoints[k]) endpoints[k] = { samples: 0, p50_ms: null, p95_ms: null, p99_ms: null, errors: n };
  }

  const mem = process.memoryUsage();
  const elLagMs =
    eld != null
      ? {
          mean_ms: Number((eld.mean / 1e6).toFixed(2)),
          p50_ms: Number((eld.percentile(50) / 1e6).toFixed(2)),
          p95_ms: Number((eld.percentile(95) / 1e6).toFixed(2)),
          p99_ms: Number((eld.percentile(99) / 1e6).toFixed(2)),
          max_ms: Number((eld.max / 1e6).toFixed(2)),
        }
      : null;
  if (eld) eld.reset();

  return {
    uptime_s: Math.round((Date.now() - counters.startedAt) / 1000),
    requests: counters.requests,
    errors_5xx: counters.errors5xx,
    errors_5xx_window_5m: errors5xxWindow.length,
    unattributed_sales: counters.unattributedSales,
    track_redirect: {
      samples: track.samples,
      p50_ms: track.p50_ms,
      p95_ms: track.p95_ms,
      p99_ms: track.p99_ms,
      slo_p95_ms: 400,
    },
    endpoints,
    event_loop: elLagMs,
    process: {
      rss_mb: Number((mem.rss / 1024 / 1024).toFixed(1)),
      heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
      heap_total_mb: Number((mem.heapTotal / 1024 / 1024).toFixed(1)),
      external_mb: Number((mem.external / 1024 / 1024).toFixed(1)),
    },
    host: {
      cpu_count: cpus()?.length || 0,
      freemem_mb: Number((freemem() / 1024 / 1024).toFixed(1)),
      totalmem_mb: Number((totalmem() / 1024 / 1024).toFixed(1)),
    },
    slow_requests_recent: slowRequestsRecent.slice(-20).map((s) => ({
      route: s.route,
      ms: s.ms,
      age_s: Math.round((Date.now() - s.at) / 1000),
    })),
    prisma_pool_hint: {
      connection_limit_env: process.env.PRISMA_CONNECTION_LIMIT || "25 (default se URL sem param)",
      pool_timeout_env: process.env.PRISMA_POOL_TIMEOUT || "20",
    },
    gc: {
      count: gcCount,
      total_ms: Number(gcTotalMs.toFixed(1)),
      recent: latencyStats(gcDurationsMs),
    },
    memory_samples: memSamples.slice(-12).map((s) => ({
      age_s: Math.round((Date.now() - s.at) / 1000),
      rss_mb: s.rss_mb,
      heap_used_mb: s.heap_used_mb,
      external_mb: s.external_mb,
    })),
    memory_growth: (() => {
      if (memSamples.length < 2) return null;
      const first = memSamples[0]!;
      const last = memSamples[memSamples.length - 1]!;
      return {
        window_s: Math.round((last.at - first.at) / 1000),
        rss_delta_mb: Number((last.rss_mb - first.rss_mb).toFixed(1)),
        heap_delta_mb: Number((last.heap_used_mb - first.heap_used_mb).toFixed(1)),
      };
    })(),
    presell_create_stages: getCreateStageSnapshot(),
    compliance_audit_queue: complianceQueueCache,
    compliance_worker: {
      embed_configured: isEmbeddedComplianceWorkerConfigured(),
      embed_running: isEmbeddedComplianceWorkerRunning(),
      /** Em prod com embed off, espera-se serviço worker dedicado. */
      expects_dedicated_worker:
        process.env.NODE_ENV === "production" && !isEmbeddedComplianceWorkerConfigured(),
      env_embedded: process.env.COMPLIANCE_WORKER_EMBEDDED ?? null,
    },
  };
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  const id = incoming || randomUUID();
  (req as Request & { requestId?: string }).requestId = id;
  res.setHeader("X-Request-Id", id);
  counters.requests += 1;
  const started = Date.now();
  const origEnd = res.end.bind(res);
  res.end = function (chunk?: unknown, encoding?: unknown, cb?: unknown) {
    const ms = Date.now() - started;
    const fullPath =
      (typeof req.originalUrl === "string" && req.originalUrl) ||
      `${req.baseUrl || ""}${req.path || ""}` ||
      req.url ||
      "";
    const route = normalizeRoutePath(req.method, fullPath);
    // Ignora health puro para não diluir métricas de produto
    if (!route.includes("/api/health")) {
      pushSample(endpointLatencies, route, ms, ENDPOINT_LATENCY_CAP);
      if (res.statusCode >= 500) {
        endpointErrors.set(route, (endpointErrors.get(route) || 0) + 1);
      }
      if (ms >= SLOW_QUERY_MS) {
        slowRequestsRecent.push({ route, ms, at: Date.now() });
        while (slowRequestsRecent.length > SLOW_CAP) slowRequestsRecent.shift();
      }
    }
    if (res.statusCode >= 500) {
      counters.errors5xx += 1;
      const now = Date.now();
      errors5xxWindow.push(now);
      pruneErrorWindow(now);
      void maybeAlert("api_5xx", {
        status: res.statusCode,
        path: req.path,
        request_id: id,
        method: req.method,
        window_5m_count: errors5xxWindow.length,
        burst: errors5xxWindow.length >= ERROR_BURST_THRESHOLD,
        latency_ms: ms,
      });
    }
    return origEnd(chunk as never, encoding as never, cb as never);
  };
  next();
}

export function getRequestId(req: Request): string | undefined {
  return (req as Request & { requestId?: string }).requestId;
}

export async function reportException(err: unknown, req?: Request): Promise<void> {
  const s = await loadSentry();
  const requestId = req ? getRequestId(req) : undefined;
  if (s) {
    s.captureException(err, {
      tags: requestId ? { request_id: requestId } : undefined,
      extra: req
        ? { path: req.path, method: req.method, request_id: requestId }
        : undefined,
    });
  }
}

export async function notifyUnattributedSale(meta: {
  userId: string;
  platform?: string | null;
  orderId?: string | null;
  reason?: string | null;
}): Promise<void> {
  counters.unattributedSales += 1;
  const s = await loadSentry();
  if (s) {
    s.captureMessage("unattributed_sale", "warning");
  }
  await maybeAlert("unattributed_sale", {
    // Não enviar userId completo a webhooks externos se possível — só hash curto
    user_id_prefix: meta.userId ? String(meta.userId).slice(0, 8) : undefined,
    platform: meta.platform,
    reason: meta.reason,
  });
}

async function maybeAlert(kind: string, payload: Record<string, unknown>): Promise<void> {
  // 5xx: só alerta em burst (≥ threshold na janela); unattributed: cooldown no sendOpsAlert.
  if (kind === "api_5xx" && payload.burst !== true) return;
  // Mantém mapa legado alinhado (testes / introspecção).
  const now = Date.now();
  lastAlertByKind.set(kind, now);
  await sendOpsAlert(kind, payload);
}

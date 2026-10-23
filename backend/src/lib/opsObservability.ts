/**
 * Observabilidade enterprise: request-id, janela deslizante 5xx, alertas por tipo,
 * amostras de latência do click path, Sentry opcional.
 * SENTRY_DSN / OPS_ALERT_WEBHOOK_URL via env — sem DSN o Sentry fica no-op.
 */
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

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

/** Regista latência do hop /track/r → oferta (amostra in-process). */
export function recordTrackRedirectLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  trackRedirectLatenciesMs.push(Math.round(ms));
  while (trackRedirectLatenciesMs.length > TRACK_LATENCY_CAP) {
    trackRedirectLatenciesMs.shift();
  }
}

export function getOpsSnapshot() {
  pruneErrorWindow();
  const samples = [...trackRedirectLatenciesMs].sort((a, b) => a - b);
  return {
    uptime_s: Math.round((Date.now() - counters.startedAt) / 1000),
    requests: counters.requests,
    errors_5xx: counters.errors5xx,
    errors_5xx_window_5m: errors5xxWindow.length,
    unattributed_sales: counters.unattributedSales,
    track_redirect: {
      samples: samples.length,
      p50_ms: percentile(samples, 50),
      p95_ms: percentile(samples, 95),
      slo_p95_ms: 400,
    },
  };
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  const id = incoming || randomUUID();
  (req as Request & { requestId?: string }).requestId = id;
  res.setHeader("X-Request-Id", id);
  counters.requests += 1;
  const origEnd = res.end.bind(res);
  res.end = function (chunk?: unknown, encoding?: unknown, cb?: unknown) {
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
  await maybeAlert("unattributed_sale", meta);
}

async function maybeAlert(kind: string, payload: Record<string, unknown>): Promise<void> {
  const url = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (!url) return;

  // 5xx: só alerta em burst (≥ threshold na janela); unattributed: cooldown por kind.
  if (kind === "api_5xx" && payload.burst !== true) return;

  const now = Date.now();
  const last = lastAlertByKind.get(kind) ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return;
  lastAlertByKind.set(kind, now);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "dclickora",
        kind,
        at: new Date().toISOString(),
        ...payload,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn("[ops] alerta falhou:", (e as Error)?.message || e);
  }
}

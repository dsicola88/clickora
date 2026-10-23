/**
 * Observabilidade Fase 0: request-id, contadores, alertas webhook, Sentry opcional.
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

let lastAlertAt = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

async function loadSentry(): Promise<SentryLike | null> {
  if (sentryTried) return sentry;
  sentryTried = true;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  try {
    // Pacote opcional — se não estiver instalado, continua sem Sentry.
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

export function getOpsSnapshot() {
  return {
    uptime_s: Math.round((Date.now() - counters.startedAt) / 1000),
    requests: counters.requests,
    errors_5xx: counters.errors5xx,
    unattributed_sales: counters.unattributedSales,
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
      void maybeAlert("api_5xx", {
        status: res.statusCode,
        path: req.path,
        request_id: id,
        method: req.method,
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
  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return;
  lastAlertAt = now;
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

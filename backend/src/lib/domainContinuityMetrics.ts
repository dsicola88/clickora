/**
 * Etapa 5 — métricas in-process do monitor de continuidade (sem PII; exposto em `getOpsSnapshot`).
 */

type TickSummary = {
  at: number;
  durationMs: number;
  candidates: number;
  checked: number;
  failures: number;
  skippedClaim: number;
  errors: number;
  alerts: number;
  failovers: number;
  recoveries: number;
};

const LATENCY_CAP = 200;

const state = {
  ticks: 0,
  ticksSkippedOverlap: 0,
  checksTotal: 0,
  checksFailed: 0,
  probeErrors: 0,
  alertsSent: 0,
  failovers: 0,
  recoveries: 0,
  lastTick: null as TickSummary | null,
  probeLatenciesMs: [] as number[],
  failoverLatenciesMs: [] as number[],
};

/** Primeira falha observada por domínio (para latência deteção→failover). */
const firstFailureAt = new Map<string, number>();

function push(arr: number[], v: number): void {
  if (!Number.isFinite(v) || v < 0) return;
  arr.push(Math.round(v));
  while (arr.length > LATENCY_CAP) arr.shift();
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export function latencySummary(samples: number[]): { samples: number; p50_ms: number | null; p95_ms: number | null; max_ms: number | null } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50_ms: percentile(sorted, 50),
    p95_ms: percentile(sorted, 95),
    max_ms: sorted.length ? sorted[sorted.length - 1]! : null,
  };
}

export function recordProbeOutcome(domainId: string, ok: boolean, latencyMs: number, now: number = Date.now()): void {
  state.checksTotal += 1;
  push(state.probeLatenciesMs, latencyMs);
  if (ok) {
    firstFailureAt.delete(domainId);
    return;
  }
  state.checksFailed += 1;
  if (!firstFailureAt.has(domainId)) firstFailureAt.set(domainId, now);
}

export function recordProbeError(): void {
  state.probeErrors += 1;
}

export function recordAlertSent(): void {
  state.alertsSent += 1;
}

export function recordFailover(domainId: string, now: number = Date.now()): void {
  state.failovers += 1;
  const started = firstFailureAt.get(domainId);
  if (started != null) push(state.failoverLatenciesMs, now - started);
}

export function recordRecovery(): void {
  state.recoveries += 1;
}

export function recordTick(summary: Omit<TickSummary, "at">, now: number = Date.now()): void {
  state.ticks += 1;
  state.lastTick = { ...summary, at: now };
}

export function recordTickSkippedOverlap(): void {
  state.ticksSkippedOverlap += 1;
}

export function getDomainContinuitySnapshot(now: number = Date.now()) {
  return {
    ticks: state.ticks,
    ticks_skipped_overlap: state.ticksSkippedOverlap,
    checks_total: state.checksTotal,
    checks_failed: state.checksFailed,
    probe_errors: state.probeErrors,
    alerts_sent: state.alertsSent,
    failovers: state.failovers,
    recoveries: state.recoveries,
    domains_failing_now: firstFailureAt.size,
    probe_latency: latencySummary(state.probeLatenciesMs),
    failover_latency: latencySummary(state.failoverLatenciesMs),
    last_tick: state.lastTick
      ? {
          age_s: Math.round((now - state.lastTick.at) / 1000),
          duration_ms: state.lastTick.durationMs,
          candidates: state.lastTick.candidates,
          checked: state.lastTick.checked,
          failures: state.lastTick.failures,
          skipped_claim: state.lastTick.skippedClaim,
          errors: state.lastTick.errors,
          alerts: state.lastTick.alerts,
          failovers: state.lastTick.failovers,
          recoveries: state.lastTick.recoveries,
        }
      : null,
  };
}

export function resetDomainContinuityMetricsForTests(): void {
  state.ticks = 0;
  state.ticksSkippedOverlap = 0;
  state.checksTotal = 0;
  state.checksFailed = 0;
  state.probeErrors = 0;
  state.alertsSent = 0;
  state.failovers = 0;
  state.recoveries = 0;
  state.lastTick = null;
  state.probeLatenciesMs = [];
  state.failoverLatenciesMs = [];
  firstFailureAt.clear();
}

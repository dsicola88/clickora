/**
 * Métricas internas do caminho crítico POST /presells (create).
 * Sem PII — só nomes de etapa e durações em ms.
 * (Sem import de opsObservability — evita ciclo de módulos.)
 */

const STAGE_CAP = 200;
const stageSamples = new Map<string, number[]>();
let createsTotal = 0;
let createsInFlight = 0;
let createsPeakInFlight = 0;

function push(stage: string, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  let arr = stageSamples.get(stage);
  if (!arr) {
    arr = [];
    stageSamples.set(stage, arr);
  }
  arr.push(Math.round(ms));
  while (arr.length > STAGE_CAP) arr.shift();
}

function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export function beginPresellCreate(): () => void {
  createsTotal += 1;
  createsInFlight += 1;
  if (createsInFlight > createsPeakInFlight) createsPeakInFlight = createsInFlight;
  return () => {
    createsInFlight = Math.max(0, createsInFlight - 1);
  };
}

export async function timedCreateStage<T>(stage: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    push(stage, Date.now() - t0);
  }
}

export function recordCreateStage(stage: string, ms: number): void {
  push(stage, ms);
}

export function getCreateStageSnapshot() {
  const stages: Record<
    string,
    { samples: number; p50_ms: number | null; p95_ms: number | null; p99_ms: number | null; avg_ms: number | null }
  > = {};
  for (const [k, samples] of stageSamples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null;
    stages[k] = {
      samples: sorted.length,
      p50_ms: pct(sorted, 50),
      p95_ms: pct(sorted, 95),
      p99_ms: pct(sorted, 99),
      avg_ms: avg != null ? Number(avg.toFixed(2)) : null,
    };
  }
  const ranked = Object.entries(stages)
    .map(([stage, s]) => ({ stage, p95_ms: s.p95_ms ?? 0, avg_ms: s.avg_ms ?? 0, samples: s.samples }))
    .sort((a, b) => b.p95_ms - a.p95_ms)
    .slice(0, 8);
  return {
    creates_total: createsTotal,
    creates_in_flight: createsInFlight,
    creates_peak_in_flight: createsPeakInFlight,
    stages,
    top_by_p95: ranked,
  };
}

/** Testes / reinícios controlados. */
export function resetCreateStageMetricsForTests(): void {
  stageSamples.clear();
  createsTotal = 0;
  createsInFlight = 0;
  createsPeakInFlight = 0;
}

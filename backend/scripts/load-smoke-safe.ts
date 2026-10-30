/**
 * Smoke de carga SEGURO — só contra hosts locais / staging explícito.
 * Recusa Railway, produção dclickora.com e qualquer URL sem ALLOW_LOAD_TEST=1 em staging.
 *
 * Uso:
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3001 ALLOW_LOAD_TEST=1 npx tsx scripts/load-smoke-safe.ts
 *
 * Mede apenas GET /api/health (sem login, sem mutações, sem ads externos).
 */
import { performance } from "node:perf_hooks";
import { assertSafeHttpTarget } from "./lib/loadTestSafety";

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const concurrency = Math.min(50, Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 10)));
const total = Math.min(2000, Math.max(1, Number(process.env.LOAD_TEST_REQUESTS || 100)));

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx]!;
}

async function main() {
  assertSafeHttpTarget(base, "health_only");
  const url = `${base}/api/health`;
  const latencies: number[] = [];
  let errors = 0;
  const t0 = performance.now();

  async function one() {
    const s = performance.now();
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) errors += 1;
    } catch {
      errors += 1;
    } finally {
      latencies.push(performance.now() - s);
    }
  }

  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      await one();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedSec = (performance.now() - t0) / 1000;
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);

  console.log(
    JSON.stringify(
      {
        target: url,
        concurrency,
        requests: total,
        errors,
        error_rate: errors / total,
        elapsed_sec: Number(elapsedSec.toFixed(3)),
        rps: Number((total / elapsedSec).toFixed(2)),
        latency_ms: {
          avg: Number(avg.toFixed(2)),
          p50: Number(percentile(latencies, 50).toFixed(2)),
          p95: Number(percentile(latencies, 95).toFixed(2)),
          p99: Number(percentile(latencies, 99).toFixed(2)),
        },
        note: "Apenas /api/health. Não valida capacidade de login/presells/ads.",
      },
      null,
      2,
    ),
  );
  if (errors > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

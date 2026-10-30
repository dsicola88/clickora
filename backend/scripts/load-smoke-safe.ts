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

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const concurrency = Math.min(50, Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 10)));
const total = Math.min(500, Math.max(1, Number(process.env.LOAD_TEST_REQUESTS || 100)));

function assertSafeTarget(url: string) {
  if (!url) {
    throw new Error("Defina LOAD_TEST_BASE_URL (ex.: http://127.0.0.1:3001)");
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("LOAD_TEST_BASE_URL inválido");
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host.includes("railway") ||
    host.includes("rlwy.net") ||
    host.includes("dclickora.com") ||
    host.includes("vercel.app") ||
    host === "0.0.0.0";
  const local = host === "127.0.0.1" || host === "localhost";
  if (blocked) {
    throw new Error(`Alvo bloqueado por segurança: ${host}. Use apenas localhost/staging dedicado.`);
  }
  if (!local && process.env.ALLOW_LOAD_TEST !== "1") {
    throw new Error("Host não local: defina ALLOW_LOAD_TEST=1 apenas em staging dedicado com dados fictícios.");
  }
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx]!;
}

async function main() {
  assertSafeTarget(base);
  const url = `${base}/api/health`;
  const latencies: number[] = [];
  let errors = 0;
  let done = 0;
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
      done += 1;
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

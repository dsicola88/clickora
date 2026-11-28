/**
 * Carga + resiliência do painel de continuidade (Etapa 5) — só leitura, só local/staging.
 *
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3001 LOAD_TEST_EMAIL=... LOAD_TEST_PASSWORD=... \
 *   LOAD_TEST_VUS=20 LOAD_TEST_REQUESTS=200 npm run load:continuity
 *
 * Mede GET /api/continuity/overview e GET /api/custom-domain com token partilhado.
 * Nunca sonda domínios, nunca dispara failover e nunca toca em anúncios.
 * SLO (falha com exit 1): erro < 1% e p95 < LOAD_TEST_P95_MS (default 1500 ms).
 */
import { performance } from "node:perf_hooks";
import { assertSafeHttpTarget } from "./lib/loadTestSafety";

type Sample = { name: string; ms: number; ok: boolean; status: number };

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const api = `${base}/api`;
const vus = Math.min(200, Math.max(1, Number(process.env.LOAD_TEST_VUS || 20)));
const total = Math.min(5_000, Math.max(1, Number(process.env.LOAD_TEST_REQUESTS || 200)));
const p95Slo = Math.max(100, Number(process.env.LOAD_TEST_P95_MS || 1_500));
const email = process.env.LOAD_TEST_EMAIL || "";
const password = process.env.LOAD_TEST_PASSWORD || "";

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

function summarize(samples: Sample[]) {
  const byName = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s);
    byName.set(s.name, arr);
  }
  const out: Record<string, unknown> = {};
  for (const [name, list] of byName) {
    const ms = list.map((s) => s.ms).sort((a, b) => a - b);
    const errors = list.filter((s) => !s.ok).length;
    out[name] = {
      requests: list.length,
      errors,
      error_rate: Number((errors / list.length).toFixed(4)),
      p50_ms: Number(pct(ms, 50).toFixed(1)),
      p95_ms: Number(pct(ms, 95).toFixed(1)),
      p99_ms: Number(pct(ms, 99).toFixed(1)),
      statuses: [...new Set(list.map((s) => s.status))],
    };
  }
  return out;
}

async function main() {
  assertSafeHttpTarget(base, "health_only");
  if (!email || !password) throw new Error("Defina LOAD_TEST_EMAIL e LOAD_TEST_PASSWORD (conta de teste).");

  const loginRes = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const lj = (await loginRes.json()) as { token?: string; error?: string };
  if (!lj.token) throw new Error(`login falhou ${loginRes.status} ${lj.error || ""}`);
  const headers = { Authorization: `Bearer ${lj.token}` };

  const targets = [
    { name: "continuity_overview", url: `${api}/continuity/overview` },
    { name: "custom_domain_list", url: `${api}/custom-domain` },
  ];
  const samples: Sample[] = [];
  let next = 0;
  const t0 = performance.now();

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      const target = targets[i % targets.length]!;
      const s = performance.now();
      try {
        const res = await fetch(target.url, { headers });
        await res.arrayBuffer();
        // 429 é resposta controlada do rate-limit (resiliência), não falha do servidor.
        samples.push({ name: target.name, ms: performance.now() - s, ok: res.ok || res.status === 429, status: res.status });
      } catch {
        samples.push({ name: target.name, ms: performance.now() - s, ok: false, status: 0 });
      }
    }
  }

  await Promise.all(Array.from({ length: vus }, () => worker()));
  const elapsed = (performance.now() - t0) / 1000;
  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => !s.ok).length;
  const p95 = pct(all, 95);
  const report = {
    target: base,
    vus,
    requests: total,
    elapsed_sec: Number(elapsed.toFixed(2)),
    rps: Number((total / elapsed).toFixed(1)),
    errors,
    error_rate: Number((errors / total).toFixed(4)),
    p95_ms: Number(p95.toFixed(1)),
    slo: { max_error_rate: 0.01, p95_ms: p95Slo },
    routes: summarize(samples),
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors / total >= 0.01 || p95 > p95Slo) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

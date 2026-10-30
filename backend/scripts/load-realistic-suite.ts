/**
 * Suite de carga REALISTA (não só /health).
 * Apenas localhost / staging com ALLOW_LOAD_TEST=1.
 *
 * Mede RPS, latências e erros por cenário. Cada "VU" (virtual user) executa um fluxo:
 * login → analytics → listar/criar/editar presell → publicar (quando possível) →
 * página pública → track impression/click → campanhas → postback.
 *
 * Uso:
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3001 \
 *   LOAD_TEST_VUS=50 LOAD_TEST_ITERATIONS=2 \
 *   LOAD_TEST_EMAIL=danielclickora1@gmail.com LOAD_TEST_PASSWORD='…' \
 *   npx tsx scripts/load-realistic-suite.ts
 *
 * Nota: VUs ≠ utilizadores humanos reais; são workers concorrentes no cliente de teste.
 */
import { performance } from "node:perf_hooks";
import { cpus, freemem, totalmem } from "node:os";
import { assertSafeHttpTarget } from "./lib/loadTestSafety";

type Sample = { name: string; ms: number; ok: boolean; status: number };

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const api = `${base}/api`;
const vus = Math.min(1000, Math.max(1, Number(process.env.LOAD_TEST_VUS || 50)));
const iterations = Math.min(20, Math.max(1, Number(process.env.LOAD_TEST_ITERATIONS || 1)));
const email = process.env.LOAD_TEST_EMAIL || "";
const password = process.env.LOAD_TEST_PASSWORD || "";
const emailB = process.env.LOAD_TEST_EMAIL_B || "";
const passwordB = process.env.LOAD_TEST_PASSWORD_B || password;

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

function summarize(samples: Sample[]) {
  const by = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = by.get(s.name) || [];
    arr.push(s);
    by.set(s.name, arr);
  }
  const out: Record<string, unknown> = {};
  for (const [name, list] of by) {
    const ms = list.map((x) => x.ms).sort((a, b) => a - b);
    const errors = list.filter((x) => !x.ok).length;
    const avg = ms.reduce((a, b) => a + b, 0) / (ms.length || 1);
    out[name] = {
      n: list.length,
      errors,
      error_rate: Number((errors / list.length).toFixed(4)),
      latency_ms: {
        avg: Number(avg.toFixed(2)),
        p50: Number(pct(ms, 50).toFixed(2)),
        p95: Number(pct(ms, 95).toFixed(2)),
        p99: Number(pct(ms, 99).toFixed(2)),
      },
    };
  }
  return out;
}

async function timed(
  name: string,
  fn: () => Promise<{ ok: boolean; status: number }>,
  sink: Sample[],
): Promise<void> {
  const t0 = performance.now();
  try {
    const r = await fn();
    sink.push({ name, ms: performance.now() - t0, ok: r.ok, status: r.status });
  } catch {
    sink.push({ name, ms: performance.now() - t0, ok: false, status: 0 });
  }
}

async function login(user: string, pass: string): Promise<string | null> {
  const res = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user, password: pass }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { token?: string };
  return j.token || null;
}

async function vuWorker(vu: number, sink: Sample[]) {
  const useB = emailB && vu % 5 === 0;
  const user = useB ? emailB : email;
  const pass = useB ? passwordB : password;
  let token: string | null = null;

  for (let i = 0; i < iterations; i++) {
    await timed("login", async () => {
      token = await login(user, pass);
      return { ok: Boolean(token), status: token ? 200 : 401 };
    }, sink);
    if (!token) continue;

    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    await timed("analytics", async () => {
      const res = await fetch(`${api}/analytics/`, { headers: auth });
      return { ok: res.status < 500, status: res.status };
    }, sink);

    await timed("campaigns_list", async () => {
      const res = await fetch(`${api}/campaigns`, { headers: auth });
      return { ok: res.status < 500, status: res.status };
    }, sink);

    let presellId: string | null = null;
    let slug = "";
    await timed("presell_create", async () => {
      slug = `load-vu${vu}-i${i}-${Date.now()}`;
      const res = await fetch(`${api}/presells`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          title: `Load VU${vu}`,
          slug,
          status: "draft",
          content: { html: `<p>load test ${vu}</p>` },
          tracking: { offerUrl: "https://example.com/offer" },
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string };
      presellId = j.id || null;
      return { ok: res.status === 201 && Boolean(presellId), status: res.status };
    }, sink);

    if (presellId) {
      await timed("presell_edit", async () => {
        const res = await fetch(`${api}/presells/${presellId}`, {
          method: "PUT",
          headers: auth,
          body: JSON.stringify({
            title: `Load VU${vu} edit`,
            content: { html: `<p>edited ${vu} ${i}</p>` },
          }),
        });
        return { ok: res.status < 500, status: res.status };
      }, sink);

      // Publicação pode falhar por compliance — contamos 2xx/4xx de negócio como não-5xx
      await timed("presell_publish_attempt", async () => {
        const res = await fetch(`${api}/presells/${presellId}/status`, {
          method: "PATCH",
          headers: auth,
          body: JSON.stringify({ status: "published" }),
        });
        return { ok: res.status < 500, status: res.status };
      }, sink);

      await timed("public_presell", async () => {
        const res = await fetch(`${api}/public/presells/${slug}`);
        // 404 draft ok sob carga; 5xx = falha
        return { ok: res.status < 500, status: res.status };
      }, sink);

      await timed("track_impression", async () => {
        const res = await fetch(`${api}/track/impression`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presell_id: presellId, slug }),
        });
        return { ok: res.status < 500, status: res.status };
      }, sink);

      await timed("track_click", async () => {
        const res = await fetch(`${api}/track/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presell_id: presellId, slug }),
        });
        return { ok: res.status < 500, status: res.status };
      }, sink);

      await timed("postback_attempt", async () => {
        const res = await fetch(
          `${api}/track/postback?click_id=00000000-0000-4000-8000-000000000000&payout=1&txid=load-${vu}-${i}-${Date.now()}`,
        );
        return { ok: res.status < 500, status: res.status };
      }, sink);
    }

    await timed("health", async () => {
      const res = await fetch(`${api}/health`);
      return { ok: res.ok, status: res.status };
    }, sink);
  }
}

async function main() {
  assertSafeHttpTarget(base, "mutating");
  if (!email || !password) throw new Error("LOAD_TEST_EMAIL e LOAD_TEST_PASSWORD obrigatórios");

  const samples: Sample[] = [];
  const memBefore = { free: freemem(), total: totalmem(), cpus: cpus().length };
  const t0 = performance.now();

  const workers = Array.from({ length: vus }, (_, vu) => vuWorker(vu, samples));
  await Promise.all(workers);

  const elapsed = (performance.now() - t0) / 1000;
  const errors = samples.filter((s) => !s.ok).length;
  const report = {
    target: api,
    vus,
    iterations_per_vu: iterations,
    total_operations: samples.length,
    elapsed_sec: Number(elapsed.toFixed(3)),
    rps_operations: Number((samples.length / elapsed).toFixed(2)),
    errors,
    error_rate: Number((errors / (samples.length || 1)).toFixed(4)),
    by_scenario: summarize(samples),
    host: {
      cpus: memBefore.cpus,
      mem_total_mb: Math.round(memBefore.total / 1e6),
      mem_free_mb_start: Math.round(memBefore.free / 1e6),
      mem_free_mb_end: Math.round(freemem() / 1e6),
    },
    notes: [
      "VUs = workers concorrentes do cliente de teste, não utilizadores humanos medidos no browser.",
      "presell_publish_attempt pode ser 4xx (compliance) — conta como ok se <500.",
      "Rate limit track: Redis se REDIS_URL; senão memória.",
      "CPU/memória: amostra do host do cliente de teste (os), não do contentor Railway.",
    ],
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors / (samples.length || 1) > 0.05) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

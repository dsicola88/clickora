/**
 * Carga autenticada: 1 login (ou poucos) + N workers com o mesmo token JWT.
 * Separa o bottleneck de rate-limit/bcrypt do comportamento das rotas de produto.
 *
 * LOAD_TEST_BASE_URL=http://127.0.0.1:3001 LOAD_TEST_VUS=100 \
 * LOAD_TEST_EMAIL=... LOAD_TEST_PASSWORD=... npx tsx scripts/load-authed-burst.ts
 */
import { performance } from "node:perf_hooks";
import { freemem, totalmem, cpus } from "node:os";
import { assertSafeHttpTarget } from "./lib/loadTestSafety";

type S = { name: string; ms: number; ok: boolean; status: number };
const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const api = `${base}/api`;
const vus = Math.min(1000, Math.max(1, Number(process.env.LOAD_TEST_VUS || 100)));
const email = process.env.LOAD_TEST_EMAIL || "";
const password = process.env.LOAD_TEST_PASSWORD || "";

function pct(a: number[], p: number) {
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1)]!;
}

function sum(samples: S[]) {
  const m = new Map<string, S[]>();
  for (const s of samples) {
    (m.get(s.name) || m.set(s.name, []).get(s.name)!).push(s);
  }
  const o: Record<string, unknown> = {};
  for (const [k, list] of m) {
    const ms = list.map((x) => x.ms).sort((a, b) => a - b);
    const errors = list.filter((x) => !x.ok).length;
    o[k] = {
      n: list.length,
      errors,
      error_rate: Number((errors / list.length).toFixed(4)),
      latency_ms: {
        avg: Number((ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2)),
        p50: Number(pct(ms, 50).toFixed(2)),
        p95: Number(pct(ms, 95).toFixed(2)),
        p99: Number(pct(ms, 99).toFixed(2)),
      },
    };
  }
  return o;
}

async function timed(name: string, fn: () => Promise<{ ok: boolean; status: number }>, sink: S[]) {
  const t0 = performance.now();
  try {
    const r = await fn();
    sink.push({ name, ms: performance.now() - t0, ok: r.ok, status: r.status });
  } catch {
    sink.push({ name, ms: performance.now() - t0, ok: false, status: 0 });
  }
}

async function main() {
  assertSafeHttpTarget(base, "mutating");
  if (!email || !password) throw new Error("credenciais");

  const loginRes = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const lj = (await loginRes.json()) as { token?: string; error?: string };
  if (!lj.token) throw new Error(`login falhou ${loginRes.status} ${lj.error || ""}`);
  const token = lj.token;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const samples: S[] = [];
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: vus }, async (_, vu) => {
      await timed("analytics", async () => {
        const r = await fetch(`${api}/analytics/`, { headers: auth });
        return { ok: r.status < 500, status: r.status };
      }, samples);
      await timed("campaigns_list", async () => {
        const r = await fetch(`${api}/campaigns`, { headers: auth });
        return { ok: r.status < 500, status: r.status };
      }, samples);
      let id: string | null = null;
      const slug = `burst-${vu}-${Date.now()}`;
      await timed("presell_create", async () => {
        const r = await fetch(`${api}/presells`, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({
            title: `Burst ${vu}`,
            slug,
            status: "draft",
            content: { html: `<p>b${vu}</p>` },
            tracking: { offerUrl: "https://example.com/o" },
          }),
        });
        const j = (await r.json().catch(() => ({}))) as { id?: string };
        id = j.id || null;
        return { ok: r.status === 201 && !!id, status: r.status };
      }, samples);
      if (!id) return;
      await timed("presell_edit", async () => {
        const r = await fetch(`${api}/presells/${id}`, {
          method: "PUT",
          headers: auth,
          body: JSON.stringify({ title: `Burst edit ${vu}`, content: { html: `<p>e${vu}</p>` } }),
        });
        return { ok: r.status < 500, status: r.status };
      }, samples);
      await timed("track_impression", async () => {
        const r = await fetch(`${api}/track/impression`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presell_id: id, slug }),
        });
        return { ok: r.status < 500, status: r.status };
      }, samples);
      await timed("track_click", async () => {
        const r = await fetch(`${api}/track/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presell_id: id, slug }),
        });
        return { ok: r.status < 500, status: r.status };
      }, samples);
      await timed("public_get", async () => {
        const r = await fetch(`${api}/public/presells/${slug}`);
        return { ok: r.status < 500, status: r.status };
      }, samples);
    }),
  );

  const elapsed = (performance.now() - t0) / 1000;
  const errors = samples.filter((s) => !s.ok).length;
  const report = {
    mode: "authed_burst_shared_token",
    target: api,
    vus,
    total_operations: samples.length,
    elapsed_sec: Number(elapsed.toFixed(3)),
    rps_operations: Number((samples.length / elapsed).toFixed(2)),
    errors,
    error_rate: Number((errors / (samples.length || 1)).toFixed(4)),
    by_scenario: sum(samples),
    host: {
      cpus: cpus().length,
      mem_total_mb: Math.round(totalmem() / 1e6),
      mem_free_mb_end: Math.round(freemem() / 1e6),
    },
    notes: [
      "Um único login; workers partilham JWT — mede rotas autenticadas sem rate-limit de login.",
      "Não equivale a N logins simultâneos de IPs distintos.",
    ],
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors / (samples.length || 1) > 0.05) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

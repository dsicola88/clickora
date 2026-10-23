/**
 * Smoke live dual-pillar (API real): health/ops, login, dashboard arms, onboarding, track shape.
 *
 *   E2E_API_BASE=http://127.0.0.1:3001/api \
 *   E2E_EMAIL=… E2E_PASSWORD=… \
 *   npx tsx scripts/e2e-dual-pillar-live-smoke.ts
 */
import assert from "node:assert/strict";

const API = (process.env.E2E_API_BASE || "http://127.0.0.1:3001/api").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL || "danielclickora@gmail.com";
const PASS = process.env.E2E_PASSWORD || "Dpa211088@";

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(id: string, ok: boolean, detail: string) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function json(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 240) };
  }
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  const health = await json("/health");
  const h = health.body as Record<string, unknown>;
  check("health_ok", health.status === 200 && h?.status === "ok", `http=${health.status}`);
  const ops = (h?.ops || {}) as Record<string, unknown>;
  const track = (ops.track_redirect || {}) as Record<string, unknown>;
  check(
    "ops_track_slo",
    typeof track.slo_p95_ms === "number" && Number(track.slo_p95_ms) > 0,
    `slo_p95_ms=${track.slo_p95_ms ?? "missing"}`,
  );
  check("ops_request_id", Boolean(h.request_id), `request_id=${h.request_id ?? "missing"}`);

  let plans = await json("/plans");
  if (plans.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    plans = await json("/plans");
  }
  check(
    "plans_catalog",
    plans.status === 200 && Array.isArray(plans.body) && (plans.body as unknown[]).length > 0,
    `http=${plans.status} n=${Array.isArray(plans.body) ? (plans.body as unknown[]).length : 0}`,
  );

  const login = await json("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const token = (login.body as { token?: string } | null)?.token;
  check("login", login.status === 200 && Boolean(token), `http=${login.status}`);
  assert.ok(token, "token required for remaining checks");

  const auth = { Authorization: `Bearer ${token}` };
  const from = "2026-09-01";
  const to = "2026-10-23";
  const dash = await json(`/analytics/dashboard?from=${from}&to=${to}`, { headers: auth });
  const d = dash.body as Record<string, unknown>;
  check("dashboard", dash.status === 200 && d && typeof d === "object", `http=${dash.status}`);
  check(
    "rotator_arm_performance",
    Array.isArray(d.rotator_arm_performance),
    `present=${Array.isArray(d.rotator_arm_performance)} len=${
      Array.isArray(d.rotator_arm_performance) ? d.rotator_arm_performance.length : "n/a"
    }`,
  );
  check("account_health", Boolean(d.account_health && typeof d.account_health === "object"), "field");
  check("media_buyer", Boolean(d.media_buyer && typeof d.media_buyer === "object"), "field");

  const onb = await json("/enterprise/onboarding/status", { headers: auth });
  const o = onb.body as { progress?: { done?: number; total?: number }; complete?: boolean };
  check(
    "onboarding",
    onb.status === 200 && typeof o?.progress?.total === "number",
    `http=${onb.status} ${o?.progress?.done ?? "?"}/${o?.progress?.total ?? "?"}`,
  );

  const trackR = await json("/track/r/00000000-0000-4000-8000-000000000001?to=https://example.com/x");
  check(
    "track_r_shape",
    [302, 301, 400, 403, 404].includes(trackR.status),
    `http=${trackR.status}`,
  );

  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed}/${rows.length} checks`);
  if (failed) {
    console.log("DUAL_PILLAR_LIVE_SMOKE_FAILED");
    process.exit(1);
  }
  console.log("DUAL_PILLAR_LIVE_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

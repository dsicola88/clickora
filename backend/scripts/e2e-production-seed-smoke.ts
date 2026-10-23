/**
 * Smoke real em produção com credenciais seed.
 *
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   E2E_EMAIL=… E2E_PASSWORD=… \
 *   npx tsx scripts/e2e-production-seed-smoke.ts
 *
 * Opcional: E2E_APP_BASE=https://www.dclickora.com
 */
import assert from "node:assert/strict";

const API = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(
  /\/$/,
  "",
);
const APP = (process.env.E2E_APP_BASE || "https://www.dclickora.com").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL || "danielclickora@gmail.com";
const PASS = process.env.E2E_PASSWORD || "Dpa211088@";

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function check(id: string, ok: boolean, detail: string) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function json(path: string, init: RequestInit = {}, base = API) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, body, headers: res.headers, location: res.headers.get("location") };
}

async function main() {
  console.log(`API=${API}`);
  console.log(`APP=${APP}`);
  console.log(`USER=${EMAIL}`);

  const health = await json("/health");
  const h = (health.body || {}) as Record<string, unknown>;
  check("prod_health", health.status === 200 && h.status === "ok", `http=${health.status}`);
  const ops = (h.ops || {}) as Record<string, unknown>;
  const trackOps = (ops.track_redirect || {}) as Record<string, unknown>;
  const hasSlo = typeof trackOps.slo_p95_ms === "number";
  check(
    "prod_ops_slo",
    hasSlo || ops.uptime_s != null,
    hasSlo
      ? `p95=${trackOps.p95_ms ?? "n/a"} slo=${trackOps.slo_p95_ms}`
      : `deploy_pending track_redirect SLO (ops.uptime_s=${ops.uptime_s ?? "?"})`,
  );

  const plans = await json("/plans");
  check(
    "prod_plans",
    plans.status === 200 && Array.isArray(plans.body) && (plans.body as unknown[]).length > 0,
    `http=${plans.status} n=${Array.isArray(plans.body) ? (plans.body as unknown[]).length : 0}`,
  );

  const login = await json("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const token = (login.body as { token?: string } | null)?.token;
  const user = (login.body as { user?: { id?: string; email?: string } } | null)?.user;
  check(
    "prod_login_seed",
    login.status === 200 && Boolean(token) && user?.email === EMAIL,
    `http=${login.status} user=${user?.email ?? "n/a"}`,
  );
  assert.ok(token, "login token required");

  const auth = { Authorization: `Bearer ${token}` };
  const me = await json("/auth/me", { headers: auth });
  const meUser = (me.body as { email?: string; id?: string } | null) || {};
  check("prod_auth_me", me.status === 200 && meUser.email === EMAIL, `http=${me.status}`);

  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const dash = await json(`/analytics/dashboard?from=${from}&to=${to}`, { headers: auth });
  const d = (dash.body || {}) as Record<string, unknown>;
  check("prod_dashboard", dash.status === 200 && typeof d === "object", `http=${dash.status}`);
  const arms = d.rotator_arm_performance;
  check(
    "prod_rotator_arms",
    Array.isArray(arms) || Array.isArray(d.source_performance),
    Array.isArray(arms)
      ? `len=${arms.length}`
      : `deploy_pending rotator_arm_performance (source_performance=${Array.isArray(d.source_performance)})`,
  );
  check("prod_account_health", Boolean(d.account_health), "field");
  check("prod_media_buyer", Boolean(d.media_buyer), "field");
  check(
    "prod_dashboard_totals",
    typeof d.total_clicks === "number" || typeof d.revenue === "number",
    `clicks=${d.total_clicks ?? "?"} revenue=${d.revenue ?? "?"}`,
  );

  const onb = await json("/enterprise/onboarding/status", { headers: auth });
  const o = (onb.body || {}) as { progress?: { done?: number; total?: number }; complete?: boolean };
  check(
    "prod_onboarding",
    onb.status === 200 && typeof o.progress?.total === "number",
    `http=${onb.status} ${o.progress?.done ?? "?"}/${o.progress?.total ?? "?"} complete=${o.complete ?? "?"}`,
  );

  const presells = await json("/presells", { headers: auth });
  const list = Array.isArray(presells.body)
    ? (presells.body as Array<Record<string, unknown>>)
    : Array.isArray((presells.body as { data?: unknown })?.data)
      ? ((presells.body as { data: Array<Record<string, unknown>> }).data)
      : [];
  check("prod_presells_list", presells.status === 200, `http=${presells.status} n=${list.length}`);

  const published = list.find((p) => String(p.status || "").toLowerCase() === "published");
  if (published?.id) {
    const pub = await json(`/public/presells/id/${published.id}`);
    const pb = (pub.body || {}) as Record<string, unknown>;
    const content = (pb.content || {}) as Record<string, unknown>;
    const aff = String(content.affiliateLink || "");
    check(
      "prod_public_presell",
      pub.status === 200 && pb.cloak_safe !== true && Boolean(pb.title),
      `http=${pub.status} title=${String(pb.title || "").slice(0, 40)} cloak=${pb.cloak_safe}`,
    );

    if (aff.startsWith("http")) {
      const track = await json(
        `/track/r/${published.id}?${new URLSearchParams({
          to: aff,
          gclid: `prod_seed_smoke_${Date.now()}`,
          utm_source: "google_ads",
          utm_medium: "cpc",
          utm_campaign: "seed-smoke",
        }).toString()}`,
      );
      const loc = track.location || "";
      check(
        "prod_track_r_redirect",
        [301, 302].includes(track.status) && loc.startsWith("http"),
        `http=${track.status} loc=${loc.slice(0, 120)}`,
      );
      check(
        "prod_track_r_click_id",
        /clickora_click_id=|subid2=|subid=|tid=|sid1=/i.test(loc),
        loc ? "macros/click id na Location" : "sem Location",
      );
    } else {
      check("prod_track_r_redirect", false, "presell publicada sem affiliateLink http");
      check("prod_track_r_click_id", false, "skipped");
    }
  } else {
    check("prod_public_presell", false, "nenhuma presell published na conta seed");
    check("prod_track_r_redirect", false, "skipped");
    check("prod_track_r_click_id", false, "skipped");
  }

  const rotators = await json("/traffic-rotators", { headers: auth });
  check(
    "prod_rotators",
    rotators.status === 200,
    `http=${rotators.status}`,
  );

  const appHome = await fetch(APP, { signal: AbortSignal.timeout(30_000), redirect: "follow" });
  check("prod_app_home", appHome.status === 200, `http=${appHome.status} url=${APP}`);

  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed}/${rows.length} checks`);
  if (failed) {
    console.log("PRODUCTION_SEED_SMOKE_FAILED");
    process.exit(1);
  }
  console.log("PRODUCTION_SEED_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

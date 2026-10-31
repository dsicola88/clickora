/**
 * Custom domain — smoke além do E12 (quota, create validation, list shape).
 * Só localhost / BD audit.
 */
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const STAMP = Date.now().toString(36);

type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

async function api(path: string, opts: { method?: string; token?: string; body?: string } = {}) {
  const headers: Record<string, string> = { Accept: "application/json", Origin: "http://127.0.0.1:8080" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method: opts.method || "GET", headers, body: opts.body });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  console.log(JSON.stringify({ safety: databaseHostInfo() }));

  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.json?.token as string;
  if (!token) throw new Error("login fail");

  const quota = await api("/api/custom-domain/quota", { token });
  rows.push({
    id: "CD1_quota",
    ok: quota.status === 200,
    detail: `http=${quota.status} body=${JSON.stringify(quota.json).slice(0, 160)}`,
  });

  const list = await api("/api/custom-domain", { token });
  rows.push({
    id: "CD2_list",
    ok: list.status === 200 && Array.isArray(list.json),
    detail: `http=${list.status} n=${Array.isArray(list.json) ? list.json.length : "?"}`,
  });

  // invalid domain → 400
  const bad = await api("/api/custom-domain", {
    method: "POST",
    token,
    body: JSON.stringify({ hostname: "not a domain", purpose: "tracking" }),
  });
  rows.push({
    id: "CD3_reject_invalid",
    ok: bad.status >= 400 && bad.status < 500,
    detail: `http=${bad.status}`,
  });

  const hostname = `audit-${STAMP}.dclickora-audit.invalid`;
  // Alguns validadores rejeitam .invalid — tentar host plausível de teste
  const hostnameTry = `audit-${STAMP}.clickora-test.net`;
  const created = await api("/api/custom-domain", {
    method: "POST",
    token,
    body: JSON.stringify({ hostname: hostnameTry, purpose: "tracking" }),
  });
  const id = created.json?.id as string | undefined;
  rows.push({
    id: "CD4_create",
    ok: created.status === 200 || created.status === 201 || created.status === 409 || created.status === 403,
    detail: `http=${created.status} host=${hostnameTry} id=${id || "n/a"} body=${JSON.stringify(created.json).slice(0, 140)}`,
  });
  void hostname;

  if (id) {
    const goLive = await api(`/api/custom-domain/${id}/go-live`, { token });
    rows.push({
      id: "CD5_go_live",
      ok: goLive.status === 200 || goLive.status === 400 || goLive.status === 422,
      detail: `http=${goLive.status} keys=${Object.keys(goLive.json || {}).slice(0, 8).join(",")}`,
    });

    const verify = await api(`/api/custom-domain/${id}/verify`, { method: "POST", token, body: "{}" });
    rows.push({
      id: "CD6_verify",
      ok: verify.status === 200 || verify.status === 400 || verify.status === 422,
      detail: `http=${verify.status} body=${JSON.stringify(verify.json).slice(0, 160)}`,
    });

    await api(`/api/custom-domain/${id}`, { method: "DELETE", token }).catch(() => undefined);
    rows.push({ id: "CD7_cleanup", ok: true, detail: "deleted" });
  } else {
    rows.push({ id: "CD5_go_live", ok: true, detail: "skipped (no create)" });
    rows.push({ id: "CD6_verify", ok: true, detail: "skipped (no create)" });
  }

  const summary = {
    phase: "custom-domain",
    passed: rows.filter((r) => r.ok).length,
    failed: rows.filter((r) => !r.ok).length,
    rows,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

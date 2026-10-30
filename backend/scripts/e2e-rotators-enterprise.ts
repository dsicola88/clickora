/**
 * E2E rotadores enterprise — só localhost + BD local.
 * LOAD_TEST_BASE_URL=http://127.0.0.1:3012 ALLOW_MUTATING_LOAD_TEST=1 \
 * LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… npx tsx scripts/e2e-rotators-enterprise.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget } from "./lib/loadTestSafety";

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const api = `${base}/api`;
const email = process.env.LOAD_TEST_EMAIL || "";
const password = process.env.LOAD_TEST_PASSWORD || "";

type Step = { name: string; ok: boolean; detail: string };

async function login(): Promise<string> {
  const r = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = (await r.json()) as { token?: string; error?: string };
  if (!j.token) throw new Error(`login ${r.status} ${j.error || ""}`);
  return j.token;
}

async function req(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    redirect: "manual",
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return { status: r.status, headers: r.headers, body, text };
}

async function followRotator(publicUrl: string) {
  const r = await fetch(publicUrl, { redirect: "manual", headers: { "User-Agent": "ClickoraE2E/1.0" } });
  const loc = r.headers.get("location");
  return { status: r.status, location: loc };
}

async function main() {
  assertSafeHttpTarget(base, "mutating");
  assertLocalDatabaseForMutations();
  if (!email || !password) throw new Error("LOAD_TEST_EMAIL/PASSWORD obrigatórios");

  const steps: Step[] = [];
  const prisma = new PrismaClient();
  const token = await login();
  steps.push({ name: "login", ok: true, detail: "ok" });

  // Presell published (bypass compliance gate via Prisma — same as isolation suite)
  const slug = `e2e-rot-ctx-${Date.now().toString(36)}`;
  const created = await req(token, "/presells", {
    method: "POST",
    body: JSON.stringify({
      title: "E2E Rotator Context",
      slug,
      status: "draft",
      content: { html: "<p>contexto rotador e2e</p>" },
    }),
  });
  const presellId = (created.body as { id?: string }).id;
  steps.push({ name: "create_presell", ok: created.status === 201 && !!presellId, detail: String(created.status) });
  if (!presellId) throw new Error("presell create failed");

  await prisma.presellPage.update({ where: { id: presellId }, data: { status: "published" } });
  steps.push({ name: "force_publish_presell", ok: true, detail: presellId });

  const stamp = Date.now().toString(36);

  // --- A/B 50/50 weighted ---
  const ab = await req(token, "/traffic-rotators", {
    method: "POST",
    body: JSON.stringify({
      name: `E2E A/B ${stamp}`,
      slug: `e2e-ab-${stamp}`,
      mode: "weighted",
      backup_url: "https://example.com/backup-safe",
      context_presell_id: presellId,
      arms: [
        { destination_url: "https://example.com/page-a", label: "Página A", order_index: 0, weight: 50 },
        { destination_url: "https://example.com/page-b", label: "Página B", order_index: 1, weight: 50 },
      ],
    }),
  });
  const abId = (ab.body as { id?: string }).id;
  const abUrl = (ab.body as { public_click_url?: string }).public_click_url;
  steps.push({ name: "create_ab_rotator", ok: (ab.status === 201 || ab.status === 200) && !!abId, detail: String(ab.status) });

  const hits = { a: 0, b: 0, backup: 0, other: 0 };
  const sampleLocs: string[] = [];
  for (let i = 0; i < 40; i++) {
    const h = await followRotator(`${base}/api/track/rot/${abId}`);
    const okRedirect = h.status === 302 || h.status === 301;
    if (!okRedirect) {
      steps.push({ name: `ab_hit_${i}`, ok: false, detail: `status=${h.status}` });
      break;
    }
    const loc = h.location || "";
    if (sampleLocs.length < 5) sampleLocs.push(loc);
    if (loc.includes("page-a")) hits.a++;
    else if (loc.includes("page-b")) hits.b++;
    else if (loc.includes("backup-safe")) hits.backup++;
    else hits.other++;
  }
  const abSplitOk = hits.a > 5 && hits.b > 5 && hits.backup === 0 && hits.other === 0;
  steps.push({
    name: "ab_split_distribution",
    ok: abSplitOk,
    detail: `A=${hits.a} B=${hits.b} backup=${hits.backup} other=${hits.other} samples=${JSON.stringify(sampleLocs)}`,
  });

  const abStats = await req(token, `/traffic-rotators/${abId}/ab-stats?lookback_days=7`);
  const armsStats = (abStats.body as { arms?: unknown[] }).arms;
  steps.push({
    name: "ab_stats",
    ok: abStats.status === 200 && Array.isArray(armsStats) && armsStats.length >= 2,
    detail: `status=${abStats.status} arms=${Array.isArray(armsStats) ? armsStats.length : 0}`,
  });

  // --- WhatsApp sequential round-robin ---
  const wa = await req(token, "/traffic-rotators", {
    method: "POST",
    body: JSON.stringify({
      name: `E2E WA ${stamp}`,
      slug: `e2e-wa-${stamp}`,
      mode: "sequential",
      context_presell_id: presellId,
      arms: [
        { destination_url: "https://wa.me/351911111111", label: "Vendedor 1", order_index: 0, weight: 100 },
        { destination_url: "https://wa.me/351922222222", label: "Vendedor 2", order_index: 1, weight: 100 },
        { destination_url: "https://wa.me/351933333333", label: "Vendedor 3", order_index: 2, weight: 100 },
      ],
    }),
  });
  const waId = (wa.body as { id?: string }).id;
  steps.push({ name: "create_wa_rotator", ok: (wa.status === 201 || wa.status === 200) && !!waId, detail: String(wa.status) });

  const waOrder: string[] = [];
  for (let i = 0; i < 6; i++) {
    const h = await followRotator(`${base}/api/track/rot/${waId}`);
    waOrder.push(h.location || `status:${h.status}`);
  }
  const expectedCycle = [
    "351911111111",
    "351922222222",
    "351933333333",
    "351911111111",
    "351922222222",
    "351933333333",
  ];
  const waOk = expectedCycle.every((n, i) => (waOrder[i] || "").includes(n));
  steps.push({ name: "wa_round_robin", ok: waOk, detail: waOrder.map((u) => u.replace(/^.*wa\.me\//, "")).join(" → ") });

  // --- Affiliate offers weighted ---
  const off = await req(token, "/traffic-rotators", {
    method: "POST",
    body: JSON.stringify({
      name: `E2E Offers ${stamp}`,
      slug: `e2e-off-${stamp}`,
      mode: "weighted",
      context_presell_id: presellId,
      arms: [
        { destination_url: "https://example.com/hop/offer-1?aff=x", label: "Oferta 1", order_index: 0, weight: 70 },
        { destination_url: "https://example.com/hop/offer-2?aff=y", label: "Oferta 2", order_index: 1, weight: 30 },
      ],
    }),
  });
  const offId = (off.body as { id?: string }).id;
  steps.push({ name: "create_offers_rotator", ok: (off.status === 201 || off.status === 200) && !!offId, detail: String(off.status) });
  const offHit = await followRotator(`${base}/api/track/rot/${offId}`);
  steps.push({
    name: "offers_redirect",
    ok: (offHit.status === 302 || offHit.status === 301) && (offHit.location || "").includes("example.com/hop/offer-"),
    detail: `${offHit.status} ${offHit.location}`,
  });

  // --- Contingency: only dead arms → backup ---
  const dead = await req(token, "/traffic-rotators", {
    method: "POST",
    body: JSON.stringify({
      name: `E2E Dead ${stamp}`,
      slug: `e2e-dead-${stamp}`,
      mode: "weighted",
      backup_url: "https://example.com/contingency-landing",
      context_presell_id: presellId,
      arms: [
        {
          destination_url: "https://example.com/exhausted",
          label: "Esgotado",
          order_index: 0,
          weight: 100,
          max_clicks: 1,
        },
      ],
    }),
  });
  const deadId = (dead.body as { id?: string }).id;
  steps.push({ name: "create_contingency_rotator", ok: !!deadId, detail: String(dead.status) });
  // consume the only click
  await followRotator(`${base}/api/track/rot/${deadId}`);
  const afterCap = await followRotator(`${base}/api/track/rot/${deadId}`);
  steps.push({
    name: "contingency_backup_after_cap",
    ok:
      (afterCap.status === 302 || afterCap.status === 301) &&
      (afterCap.location || "").includes("contingency-landing"),
    detail: `${afterCap.status} ${afterCap.location}`,
  });

  // --- Promote winner (needs enough clicks — may skip soft) ---
  const promote = await req(token, `/traffic-rotators/${abId}/promote-winner`, {
    method: "POST",
    body: JSON.stringify({ metric: "conversion_rate", lookback_days: 7, min_clicks_per_arm: 5 }),
  });
  // With ~20 clicks/arm and 0 conversions, promote may still pick a winner or 400 — accept 200 or structured 400
  steps.push({
    name: "promote_winner_endpoint",
    ok: promote.status === 200 || promote.status === 400 || promote.status === 422,
    detail: `status=${promote.status} body=${JSON.stringify(promote.body).slice(0, 160)}`,
  });

  // --- List + get ---
  const list = await req(token, "/traffic-rotators");
  const arr = Array.isArray(list.body) ? list.body : (list.body as { rotators?: unknown[] }).rotators;
  steps.push({
    name: "list_rotators",
    ok: list.status === 200 && Array.isArray(arr) && (arr?.length || 0) >= 3,
    detail: `status=${list.status} n=${Array.isArray(arr) ? arr.length : "?"}`,
  });

  // Cleanup
  for (const id of [abId, waId, offId, deadId]) {
    if (id) await req(token, `/traffic-rotators/${id}`, { method: "DELETE" });
  }
  await req(token, `/presells/${presellId}`, { method: "DELETE" });

  await prisma.$disconnect();

  const failed = steps.filter((s) => !s.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, target: api, abUrl, hits, waOrder, steps, failed }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

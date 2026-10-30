/**
 * Isolamento multi-tenant (HTTP IDOR) — só localhost/staging + BD local.
 *
 * LOAD_TEST_BASE_URL=http://127.0.0.1:3011 \
 * ALLOW_MUTATING_LOAD_TEST=1 \
 * LOAD_TEST_EMAIL=… LOAD_TEST_EMAIL_B=… LOAD_TEST_PASSWORD=… \
 * npx tsx scripts/security-isolation-suite.ts
 *
 * Nota: rotators exigem `context_presell_id` **published**. Em BD local a suite
 * marca o fixture como published via Prisma (compliance gate bloquearia HTTP).
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget } from "./lib/loadTestSafety";

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const api = `${base}/api`;
const pass = process.env.LOAD_TEST_PASSWORD || "";
const emailA = process.env.LOAD_TEST_EMAIL || "";
const emailB = process.env.LOAD_TEST_EMAIL_B || "";

type Step = { name: string; ok: boolean; detail: string };

async function login(email: string) {
  const r = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const j = (await r.json()) as { token?: string };
  if (!j.token) throw new Error(`login ${email} → ${r.status}`);
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
  });
  const text = await r.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: r.status, body };
}

function blocked(status: number) {
  return status === 403 || status === 404;
}

async function main() {
  assertSafeHttpTarget(base, "mutating");
  if (!emailA || !emailB || !pass) {
    throw new Error("LOAD_TEST_EMAIL, LOAD_TEST_EMAIL_B e LOAD_TEST_PASSWORD obrigatórios (sem defaults).");
  }

  const steps: Step[] = [];
  // Evitar 403 por quota após suites de carga no mesmo Postgres efémero.
  assertLocalDatabaseForMutations();
  {
    const prisma = new PrismaClient();
    try {
      await prisma.trafficRotator.deleteMany({});
      await prisma.presellPage.deleteMany({});
      await prisma.affiliateCampaign.deleteMany({});
    } finally {
      await prisma.$disconnect();
    }
  }
  const tokenA = await login(emailA);
  const tokenB = await login(emailB);

  const pA = await req(tokenA, "/presells", {
    method: "POST",
    body: JSON.stringify({
      title: "Iso A",
      slug: `iso-a-${Date.now()}`,
      status: "draft",
      content: { html: "<p>a</p>" },
    }),
  });
  const idA = (pA.body as { id?: string }).id!;
  steps.push({ name: "create_presell_a", ok: pA.status === 201 && !!idA, detail: String(pA.status) });

  for (const [name, init] of [
    ["cross_presell_get", undefined],
    ["cross_presell_delete", { method: "DELETE" } as RequestInit],
    ["cross_presell_put", { method: "PUT", body: JSON.stringify({ title: "hacked" }) } as RequestInit],
  ] as const) {
    const r = await req(tokenB, `/presells/${idA}`, init);
    steps.push({ name, ok: blocked(r.status), detail: `status=${r.status}` });
  }

  const cA = await req(tokenA, "/campaigns", {
    method: "POST",
    body: JSON.stringify({ name: `CampA ${Date.now()}`, traffic_source: "google", status: "draft" }),
  });
  const campId = (cA.body as { id?: string }).id!;
  steps.push({ name: "create_campaign_a", ok: cA.status === 201 && !!campId, detail: String(cA.status) });
  const crossCamp = await req(tokenB, `/campaigns/${campId}`);
  steps.push({ name: "cross_campaign_get", ok: blocked(crossCamp.status), detail: `status=${crossCamp.status}` });
  const crossCampDel = await req(tokenB, `/campaigns/${campId}`, { method: "DELETE" });
  steps.push({
    name: "cross_campaign_delete",
    ok: blocked(crossCampDel.status),
    detail: `status=${crossCampDel.status}`,
  });

  let rotId: string | undefined;
  if (idA) {
    assertLocalDatabaseForMutations();
    const prisma = new PrismaClient();
    try {
      await prisma.presellPage.update({
        where: { id: idA },
        data: { status: "published" },
      });
    } finally {
      await prisma.$disconnect();
    }

    const slug = `iso-rot-${Date.now().toString(36)}`;
    const rotA = await req(tokenA, "/traffic-rotators", {
      method: "POST",
      body: JSON.stringify({
        name: `IsoRot ${Date.now()}`,
        slug,
        mode: "weighted",
        context_presell_id: idA,
        arms: [{ destination_url: "https://example.com/a", order_index: 0, weight: 1 }],
      }),
    });
    rotId =
      (rotA.body as { id?: string; rotator?: { id?: string } }).id ||
      (rotA.body as { rotator?: { id?: string } }).rotator?.id;
    steps.push({
      name: "create_rotator_a",
      ok: (rotA.status === 201 || rotA.status === 200) && !!rotId,
      detail: `status=${rotA.status}`,
    });
    if (rotId) {
      const crossRotGet = await req(tokenB, `/traffic-rotators/${rotId}`);
      steps.push({
        name: "cross_rotator_get",
        ok: blocked(crossRotGet.status),
        detail: `status=${crossRotGet.status}`,
      });
      const crossRotDel = await req(tokenB, `/traffic-rotators/${rotId}`, { method: "DELETE" });
      steps.push({
        name: "cross_rotator_delete",
        ok: blocked(crossRotDel.status),
        detail: `status=${crossRotDel.status}`,
      });
    }
  }

  const blA = await req(tokenA, "/integrations/blacklist", {
    method: "POST",
    body: JSON.stringify({ ip: "203.0.113.77", reason: "iso-test" }),
  });
  steps.push({
    name: "blacklist_add_a",
    ok: blA.status === 200 || blA.status === 201 || blA.status === 409,
    detail: `status=${blA.status}`,
  });
  const blId =
    (blA.body as { id?: string; entry?: { id?: string } }).id ||
    (blA.body as { entry?: { id?: string } }).entry?.id;
  if (blId) {
    const crossBl = await req(tokenB, `/integrations/blacklist/${blId}`, { method: "DELETE" });
    steps.push({
      name: "cross_blacklist_delete",
      ok: blocked(crossBl.status),
      detail: `status=${crossBl.status}`,
    });
  } else {
    steps.push({ name: "cross_blacklist_delete", ok: true, detail: "skip (sem id)" });
  }

  const evA = await req(tokenA, "/analytics/events?limit=5");
  const evB = await req(tokenB, "/analytics/events?limit=5");
  steps.push({ name: "analytics_events_a", ok: evA.status === 200, detail: String(evA.status) });
  steps.push({ name: "analytics_events_b", ok: evB.status === 200, detail: String(evB.status) });
  const idsA = new Set(
    Array.isArray((evA.body as { events?: { id: string }[] }).events)
      ? (evA.body as { events: { id: string }[] }).events.map((e) => e.id)
      : [],
  );
  const idsB = new Set(
    Array.isArray((evB.body as { events?: { id: string }[] }).events)
      ? (evB.body as { events: { id: string }[] }).events.map((e) => e.id)
      : [],
  );
  const overlap = [...idsA].filter((id) => idsB.has(id));
  steps.push({
    name: "analytics_events_no_overlap",
    ok: overlap.length === 0,
    detail: `overlap=${overlap.length}`,
  });

  const paidB = await req(tokenB, "/paid/projects");
  steps.push({
    name: "paid_gate_or_list",
    ok: paidB.status === 403 || paidB.status === 200,
    detail: `status=${paidB.status}`,
  });

  // Rotator referencia a presell — apagar rotador antes da página.
  if (rotId) await req(tokenA, `/traffic-rotators/${rotId}`, { method: "DELETE" });
  if (campId) await req(tokenA, `/campaigns/${campId}`, { method: "DELETE" });
  if (idA) await req(tokenA, `/presells/${idA}`, { method: "DELETE" });

  const failed = steps.filter((s) => !s.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, target: api, steps, failed }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

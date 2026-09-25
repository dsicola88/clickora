/**
 * Auditoria E2E real: Google Ads GCLID → /track/r/ → hoplink → Digistore postback → conversão.
 *
 * Uso (backend):
 *   DATABASE_URL=postgresql://clickora:clickora@127.0.0.1:5434/clickora_e2e \
 *   JWT_SECRET=e2e-secret PORT=3011 \
 *   npx tsx scripts/e2e-conversion-attribution-audit.ts
 *
 * Pressupõe API já a correr no PORT (ou arranca um filho se E2E_START_SERVER=1).
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createPostbackToken } from "../src/lib/postbackToken";
import { appendClickIdToAffiliateUrl } from "../src/lib/appendClickIdToUrl";

const BASE = (process.env.E2E_API_BASE || `http://127.0.0.1:${process.env.PORT || 3011}/api`).replace(
  /\/$/,
  "",
);
const EMAIL = `e2e-conv-${Date.now()}@dclickora.local`;
const PASS = "E2eConvAudit!99";
const GCLID = `EAIaIQobChMI_e2e_${createHash("sha1").update(EMAIL).digest("hex").slice(0, 16)}`;

type CaseResult = { id: string; name: string; pass: boolean; detail: string };

const results: CaseResult[] = [];
const prisma = new PrismaClient();

function record(id: string, name: string, pass: boolean, detail: string) {
  results.push({ id, name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id} ${name} — ${detail}`);
}

async function waitForHealth(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`API health timeout em ${BASE}`);
}

async function ensurePlans() {
  await prisma.plan.upsert({
    where: { id: "plan_free" },
    update: { affiliateWebhookEnabled: false },
    create: {
      id: "plan_free",
      name: "Starter",
      type: "free_trial",
      priceCents: 0,
      maxPresellPages: 10,
      maxClicksPerMonth: 10000,
      affiliateWebhookEnabled: false,
      features: [],
    },
  });
  await prisma.plan.upsert({
    where: { id: "plan_annual" },
    update: { affiliateWebhookEnabled: true },
    create: {
      id: "plan_annual",
      name: "Pro Anual",
      type: "annual",
      priceCents: 19600,
      maxPresellPages: null,
      maxClicksPerMonth: null,
      affiliateWebhookEnabled: true,
      features: [],
    },
  });
}

async function createUser(planId: string) {
  const password = await bcrypt.hash(PASS, 10);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      password,
      fullName: "E2E Conversion Audit",
      subscription: { create: { planId, status: "active" } },
      roles: { create: { role: "user" } },
    },
  });
  return user;
}

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const body = (await r.json()) as { token?: string; access_token?: string; error?: string };
  assert.equal(r.status, 200, `login ${r.status} ${JSON.stringify(body)}`);
  const token = body.token || body.access_token;
  assert.ok(token, "token em falta");
  return token!;
}

async function createPresell(auth: string) {
  const r = await fetch(`${BASE}/presells`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "E2E Digistore Presell",
      slug: `e2e-ds-${Date.now()}`,
      type: "cookies",
      status: "published",
      content: {},
      settings: {},
      tracking: { offerUrl: "https://www.digistore24.com/redir/e2e-product/demo/" },
    }),
  });
  const body = (await r.json()) as { id?: string; error?: string };
  assert.ok(r.ok && body.id, `presell create fail ${r.status} ${JSON.stringify(body)}`);
  return body.id!;
}

async function trackRedirect(presellId: string, offerUrl: string, extra: Record<string, string> = {}) {
  const u = new URL(`${BASE}/track/r/${presellId}`);
  u.searchParams.set("to", offerUrl);
  u.searchParams.set("gclid", GCLID);
  u.searchParams.set("campaign", "e2e-google-camp");
  u.searchParams.set("utm_source", "google");
  u.searchParams.set("utm_medium", "cpc");
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);

  const r = await fetch(u.toString(), { redirect: "manual" });
  assert.equal(r.status, 302, `redirect status ${r.status}`);
  const loc = r.headers.get("location");
  assert.ok(loc, "Location em falta");
  return new URL(loc!);
}

async function postback(token: string, params: Record<string, string>) {
  const u = new URL(`${BASE}/integrations/affiliate-webhook`);
  u.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  const body = (await r.json()) as Record<string, unknown>;
  return { status: r.status, body };
}

async function main() {
  console.log(`E2E base=${BASE} email=${EMAIL}`);

  let child: ChildProcess | null = null;
  if (process.env.E2E_START_SERVER === "1") {
    child = spawn("npx", ["tsx", "src/server.ts"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => process.stdout.write(`[api] ${d}`));
    child.stderr?.on("data", (d) => process.stderr.write(`[api] ${d}`));
  }

  try {
    await waitForHealth();
    await ensurePlans();

    // Utilizador Premium (webhook ON)
    const user = await createUser("plan_annual");
    const auth = await login();
    const presellId = await createPresell(auth);
    const pbToken = createPostbackToken(user.id);

    // --- 1) GCLID → track → Digistore cid → conversão ---
    const offer1 = "https://www.digistore24.com/redir/e2e-product/demo/";
    const loc1 = await trackRedirect(presellId, offer1);
    const cid1 = loc1.searchParams.get("cid");
    const clickora1 = loc1.searchParams.get("clickora_click_id");
    const sid1a = loc1.searchParams.get("sid1");
    assert.ok(cid1 && clickora1 && cid1 === clickora1, `cid mismatch ${cid1} ${clickora1}`);
    assert.equal(sid1a, cid1);

    const clickRow = await prisma.trackingEvent.findFirst({
      where: { id: cid1!, userId: user.id, eventType: "click" },
    });
    const meta = (clickRow?.metadata || {}) as Record<string, unknown>;
    const gclidStored = typeof meta.gclid === "string" ? meta.gclid : "";
    record(
      "1",
      "GCLID→track→hoplink cid",
      Boolean(clickRow && gclidStored === GCLID && cid1),
      `click=${cid1} gclid=${gclidStored} campaign=${clickRow?.campaign}`,
    );

    const order1 = `DS-ORD-${randomUUID().slice(0, 8)}`;
    const pb1 = await postback(pbToken, {
      platform: "Digistore24",
      cid: cid1!,
      billing_status: "completed",
      amount_affiliate: "42.50",
      currency: "EUR",
      order_id: order1,
    });
    const conv1 = await prisma.conversion.findFirst({ where: { clickId: cid1! } });
    record(
      "1b",
      "Postback Digistore → conversão atribuída + receita",
      pb1.status === 200 &&
        pb1.body.conversion === "created" &&
        conv1?.attribution === "attributed" &&
        Number(conv1?.amount) === 42.5 &&
        conv1?.currency === "EUR" &&
        conv1?.presellId === presellId &&
        conv1?.campaign === "e2e-google-camp",
      `http=${pb1.status} result=${pb1.body.conversion} amount=${conv1?.amount} cy=${conv1?.currency} attr=${conv1?.attribution}`,
    );

    // --- 2) sid1 fallback quando cid é de outro tracker ---
    const offer2 = "https://www.digistore24.com/redir/e2e-product/demo/?cid=OTHER_TRACKER_TOKEN";
    const loc2 = await trackRedirect(presellId, offer2);
    record(
      "6",
      "Não sobrescreve cid externo; sid1=Clickora UUID",
      loc2.searchParams.get("cid") === "OTHER_TRACKER_TOKEN" &&
        Boolean(loc2.searchParams.get("sid1")) &&
        loc2.searchParams.get("sid1") === loc2.searchParams.get("clickora_click_id") &&
        loc2.searchParams.get("sid1") !== "OTHER_TRACKER_TOKEN",
      `cid=${loc2.searchParams.get("cid")} sid1=${loc2.searchParams.get("sid1")}`,
    );

    const sid1 = loc2.searchParams.get("sid1")!;
    const order2 = `DS-ORD-${randomUUID().slice(0, 8)}`;
    const pb2 = await postback(pbToken, {
      platform: "Digistore24",
      cid: "OTHER_TRACKER_TOKEN",
      sid1,
      billing_status: "completed",
      amount_affiliate: "10.00",
      currency: "EUR",
      order_id: order2,
    });
    const conv2 = await prisma.conversion.findFirst({ where: { clickId: sid1 } });
    record(
      "2",
      "sid1 fallback atribui quando cid não é UUID",
      pb2.body.conversion === "created" && conv2?.attribution === "attributed" && Number(conv2?.amount) === 10,
      `result=${pb2.body.conversion} click=${conv2?.clickId} amount=${conv2?.amount}`,
    );

    // --- 3) campos Digistore explícitos (já cobertos em 1b; reforço paying) ---
    const loc3 = await trackRedirect(presellId, offer1);
    const cid3 = loc3.searchParams.get("cid")!;
    const pb3 = await postback(pbToken, {
      platform: "Digistore24",
      cid: cid3,
      sid1: cid3,
      billing_status: "paying",
      amount_affiliate: "5.00",
      currency: "USD",
      order_id: `DS-PAY-${randomUUID().slice(0, 8)}`,
    });
    record(
      "3",
      "billing_status=paying + amount_affiliate + cid + sid1",
      pb3.body.conversion === "created",
      `result=${pb3.body.conversion}`,
    );

    // --- 4) refund / chargeback ---
    const loc4 = await trackRedirect(presellId, offer1);
    const cid4 = loc4.searchParams.get("cid")!;
    const pbRefund = await postback(pbToken, {
      cid: cid4,
      billing_status: "completed",
      transaction_type: "refund",
      amount_affiliate: "99",
      order_id: `DS-REF-${randomUUID().slice(0, 8)}`,
    });
    const pbCb = await postback(pbToken, {
      cid: cid4,
      billing_status: "completed",
      transaction_type: "chargeback",
      amount_affiliate: "99",
      order_id: `DS-CB-${randomUUID().slice(0, 8)}`,
    });
    const badConv = await prisma.conversion.findFirst({ where: { clickId: cid4 } });
    record(
      "4",
      "refund/chargeback sem venda prévia → não cria conversão (honesto)",
      (pbRefund.body.conversion === "refund_not_found" ||
        pbRefund.body.conversion === "skipped_not_approved") &&
        (pbCb.body.conversion === "refund_not_found" || pbCb.body.conversion === "skipped_not_approved") &&
        !badConv,
      `refund=${pbRefund.body.conversion} cb=${pbCb.body.conversion} conv=${Boolean(badConv)}`,
    );

    // --- 5) CTA directo / sem click id → não atribuída (não inventa atribuição) ---
    const order5 = `DS-NA-${randomUUID().slice(0, 8)}`;
    const pb5 = await postback(pbToken, {
      platform: "Digistore24",
      billing_status: "completed",
      amount_affiliate: "33.00",
      currency: "EUR",
      order_id: order5,
    });
    const conv5 = await prisma.conversion.findFirst({ where: { externalOrderId: order5 } });
    record(
      "5",
      "Sem tracking → conversão não atribuída (não falsa)",
      pb5.body.conversion === "created_unattributed" &&
        conv5?.attribution === "unattributed" &&
        conv5.clickId == null &&
        conv5.presellId == null &&
        Number(conv5.amount) === 33,
      `result=${pb5.body.conversion} attr=${conv5?.attribution} reason=${pb5.body.unattributed_reason}`,
    );

    // --- 7) plano sem webhook ---
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { planId: "plan_free" },
    });
    const pb7 = await postback(pbToken, {
      cid: cid1!,
      billing_status: "completed",
      amount_affiliate: "1",
      order_id: `DS-PLAN-${randomUUID().slice(0, 8)}`,
    });
    record(
      "7",
      "Plano sem webhook → 403 AFFILIATE_WEBHOOK_PLAN",
      pb7.status === 403 && pb7.body.code === "AFFILIATE_WEBHOOK_PLAN",
      `status=${pb7.status} code=${pb7.body.code}`,
    );
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { planId: "plan_annual" },
    });

    // --- 8) idempotência ---
    const pbDup = await postback(pbToken, {
      platform: "Digistore24",
      cid: cid1!,
      billing_status: "completed",
      amount_affiliate: "42.50",
      currency: "EUR",
      order_id: order1,
    });
    const countDup = await prisma.conversion.count({ where: { clickId: cid1! } });
    record(
      "8",
      "Reenvio postback → duplicate, 1 conversão",
      pbDup.body.conversion === "duplicate" && countDup === 1,
      `result=${pbDup.body.conversion} count=${countDup}`,
    );

    // --- 9) valores monetários ---
    async function moneyCase(label: string, amount: string | undefined, expectAmount: number | null) {
      const loc = await trackRedirect(presellId, offer1);
      const cid = loc.searchParams.get("cid")!;
      const params: Record<string, string> = {
        cid,
        billing_status: "completed",
        order_id: `DS-M-${label}-${randomUUID().slice(0, 6)}`,
        currency: "EUR",
      };
      if (amount !== undefined) params.amount_affiliate = amount;
      const pb = await postback(pbToken, params);
      const c = await prisma.conversion.findFirst({ where: { clickId: cid } });
      const ok =
        pb.body.conversion === "created" &&
        (expectAmount === null ? c?.amount == null : Number(c?.amount) === expectAmount);
      record(`9.${label}`, `Valor ${label}`, ok, `amount_in=${amount} stored=${c?.amount} cy=${c?.currency}`);
    }
    await moneyCase("zero", "0", 0);
    await moneyCase("ausente", undefined, null);
    await moneyCase("invalido", "abc", null);
    await moneyCase("virgula", "12,34", 12.34);

    // --- 10) dashboard ---
    const dash = await fetch(`${BASE}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    const dashBody = (await dash.json()) as Record<string, number>;
    const sum = await fetch(`${BASE}/analytics?detail=1`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    const sumBody = (await sum.json()) as {
      by_presell?: Array<Record<string, number | string>>;
      by_campaign?: Array<{ campaign: string; conversions: number; revenue: number }>;
    };
    const hasPresellRev = (sumBody.by_presell || []).some(
      (r) => r.presell_id === presellId && Number(r.revenue) > 0 && Number(r.conversions) > 0,
    );
    const hasCamp = (sumBody.by_campaign || []).some(
      (r) => r.campaign === "e2e-google-camp" && r.conversions > 0 && r.revenue > 0,
    );
    record(
      "10",
      "Dashboard: cliques/conversões/receita/taxa + por campanha/presell",
      dash.ok &&
        Number(dashBody.total_clicks) >= 1 &&
        Number(dashBody.total_conversions) >= 1 &&
        Number(dashBody.revenue) > 0 &&
        typeof dashBody.conversion_rate === "number" &&
        hasPresellRev &&
        hasCamp,
      `clicks=${dashBody.total_clicks} conv=${dashBody.total_conversions} rev=${dashBody.revenue} cvr=${dashBody.conversion_rate} presell=${hasPresellRev} camp=${hasCamp}`,
    );

    // --- 11) logs auditoria ---
    const logs = await prisma.postbackLog.findMany({
      where: { userId: user.id, platform: "affiliate_webhook" },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const hasRejected = logs.some((l) => l.status === "rejected" || String(l.message).includes("skipped_not_approved"));
    const hasUna = logs.some((l) => String(l.message).includes("created_unattributed"));
    const hasCreated = logs.some((l) => l.message === "created" || String(l.payload).includes('"conversion":"created"'));
    record(
      "11",
      "PostbackLog distingue aceite/rejeitado/não atribuída",
      hasRejected && hasUna && hasCreated && logs.length >= 3,
      `logs=${logs.length} rejected=${hasRejected} una=${hasUna} created=${hasCreated} sample=${logs.slice(0, 5).map((l) => `${l.status}:${l.message}`).join(" | ")}`,
    );

    // --- 12) compra ponta-a-ponta simulada (fluxo completo separado) ---
    const offer12 = "https://www.digistore24.com/redir/real-sim/demo/";
    const loc12 = await trackRedirect(presellId, offer12, { campaign: "e2e-real-buy" });
    const hop = appendClickIdToAffiliateUrl(offer12, loc12.searchParams.get("cid")!);
    // simula Digistore a ecoar cid do hoplink
    const echoed = new URL(hop).searchParams.get("cid")!;
    const order12 = `DS-REAL-${randomUUID().slice(0, 8)}`;
    const pb12 = await postback(pbToken, {
      platform: "Digistore24",
      cid: echoed,
      sid1: echoed,
      billing_status: "completed",
      amount_affiliate: "99.99",
      currency: "EUR",
      order_id: order12,
    });
    const conv12 = await prisma.conversion.findFirst({
      where: { externalOrderId: order12 },
      include: { click: true },
    });
    const gclid12 = (conv12?.click?.metadata as Record<string, unknown> | null)?.gclid;
    record(
      "12",
      "E2E compra simulada ponta-a-ponta",
      pb12.body.conversion === "created" &&
        conv12?.attribution === "attributed" &&
        Number(conv12?.amount) === 99.99 &&
        gclid12 === GCLID &&
        conv12?.campaign === "e2e-real-buy",
      `result=${pb12.body.conversion} amount=${conv12?.amount} gclid=${gclid12} camp=${conv12?.campaign}`,
    );

    // --- 13) Honestidade: utm_campaign slug + macros descartadas + msclkid ---
    const loc13 = await trackRedirect(presellId, offer1, {
      campaign: "",
      utm_campaign: "neotonics-us",
      utm_term: "{keyword}",
      utm_content: "{adgroupid}",
      utm_medium: "cpc",
    });
    const cid13 = loc13.searchParams.get("cid")!;
    const click13 = await prisma.trackingEvent.findFirst({ where: { id: cid13 } });
    const m13 = (click13?.metadata || {}) as Record<string, unknown>;
    const termOk = m13.utm_term == null || m13.utm_term === undefined || m13.utm_term === "";
    const contentOk = m13.utm_content == null || m13.utm_content === undefined || m13.utm_content === "";
    record(
      "13",
      "utm_campaign slug + macros literais descartadas",
      click13?.campaign === "neotonics-us" &&
        (m13.utm_campaign === "neotonics-us" || click13?.campaign === "neotonics-us") &&
        termOk &&
        contentOk,
      `camp=${click13?.campaign} utm_campaign=${m13.utm_campaign} term=${String(m13.utm_term)} content=${String(m13.utm_content)}`,
    );

    const MSCLKID = `msclkid_e2e_${createHash("sha1").update(EMAIL).digest("hex").slice(0, 12)}`;
    const uBing = new URL(`${BASE}/track/r/${presellId}`);
    uBing.searchParams.set("to", offer1);
    uBing.searchParams.set("msclkid", MSCLKID);
    uBing.searchParams.set("utm_campaign", "bing-camp-slug");
    uBing.searchParams.set("utm_source", "bing");
    const rBing = await fetch(uBing.toString(), { redirect: "manual" });
    const locBing = rBing.status === 302 ? new URL(rBing.headers.get("location")!) : null;
    const cidBing = locBing?.searchParams.get("cid");
    const clickBing = cidBing
      ? await prisma.trackingEvent.findFirst({ where: { id: cidBing } })
      : null;
    const mBing = (clickBing?.metadata || {}) as Record<string, unknown>;
    record(
      "13b",
      "Bing msclkid capturado no clique (sem inventar custo)",
      rBing.status === 302 && Boolean(cidBing) && mBing.msclkid === MSCLKID && clickBing?.campaign === "bing-camp-slug",
      `status=${rBing.status} msclkid=${String(mBing.msclkid)} camp=${clickBing?.campaign}`,
    );

    // --- 14) Spend truth no dashboard: sem sync → spend null / não inventa ROAS ---
    const dashHonesty = await fetch(`${BASE}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    const dh = (await dashHonesty.json()) as {
      media_buyer?: {
        spend: number | null;
        spend_source?: string;
        profit: number | null;
        roas: number | null;
        profit_uses_period_spend?: boolean;
        revenue?: number;
      };
      revenue?: number;
      approved_sales_count?: number;
    };
    const mb = dh.media_buyer;
    const spendHonest =
      mb != null &&
      (mb.spend_source === "none" || mb.spend_source === "manual"
        ? mb.spend == null && mb.roas == null && mb.profit_uses_period_spend === false
        : mb.spend_source === "persisted" || mb.spend_source === "google_ads"
          ? mb.profit_uses_period_spend === true
          : false);
    record(
      "14",
      "Dashboard spend truth (sem sync → sem ROAS inventado)",
      dashHonesty.ok && spendHonest && Number(dh.approved_sales_count ?? 0) >= 1 && Number(dh.revenue ?? 0) > 0,
      `source=${mb?.spend_source} spend=${mb?.spend} roas=${mb?.roas} profit_period=${mb?.profit_uses_period_spend} rev=${dh.revenue}`,
    );

    // cleanup user data (keep plans)
    await prisma.conversion.deleteMany({ where: { userId: user.id } });
    await prisma.postbackLog.deleteMany({ where: { userId: user.id } });
    await prisma.trackingEvent.deleteMany({ where: { userId: user.id } });
    await prisma.presellPage.deleteMany({ where: { userId: user.id } });
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } finally {
    await prisma.$disconnect();
    if (child?.pid) {
      child.kill("SIGTERM");
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log("\n======== RESUMO E2E ========");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.id}\t${r.name}\t${r.detail}`);
  }
  console.log(`Total: ${results.length} | PASS: ${results.length - failed.length} | FAIL: ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

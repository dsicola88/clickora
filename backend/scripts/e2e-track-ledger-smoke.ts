/**
 * Smoke HTTP: login → create draft → publish (Prisma bypass gate) → /track/r/ → webhook → conversion.
 * Só localhost/CI. Sem Hotmart/OAuth/Ads.
 *
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 \
 *   ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/e2e-track-ledger-smoke.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget } from "./lib/loadTestSafety";

const base = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const api = `${base}/api`;
const email = process.env.LOAD_TEST_EMAIL || "";
const pass = process.env.LOAD_TEST_PASSWORD || "";
const OFFER = "https://example.com/offer-e2e-smoke";

type Step = { name: string; ok: boolean; detail: string };

function record(steps: Step[], name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

async function main() {
  assertSafeHttpTarget(base, "mutating");
  assertLocalDatabaseForMutations();
  if (!email || !pass) {
    throw new Error("LOAD_TEST_EMAIL e LOAD_TEST_PASSWORD obrigatórios.");
  }

  const steps: Step[] = [];
  const prisma = new PrismaClient();
  const stamp = Date.now().toString(36);

  try {
    const loginRes = await fetch(`${api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    const loginBody = (await loginRes.json()) as { token?: string };
    const token = loginBody.token;
    record(steps, "login", loginRes.status === 200 && Boolean(token), `http=${loginRes.status}`);
    if (!token) throw new Error("sem token");

    const auth = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const meRes = await fetch(`${api}/auth/me`, { headers: auth });
    const me = (await meRes.json()) as { id?: string };
    const userId = me.id;
    record(steps, "me", meRes.status === 200 && Boolean(userId), `http=${meRes.status}`);
    if (!userId) throw new Error("sem userId");

    // Garantir plano com webhook (seed Pro/Anual já tem; reforça se BD antiga).
    const plan = await prisma.plan.upsert({
      where: { id: "plan_monthly" },
      create: {
        id: "plan_monthly",
        name: "Pro Mensal",
        type: "monthly",
        priceCents: 2400,
        affiliateWebhookEnabled: true,
        maxPresellPages: 25,
      },
      update: { affiliateWebhookEnabled: true },
    });
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, planId: plan.id, status: "active" },
      update: { planId: plan.id, status: "active" },
    });

    const createRes = await fetch(`${api}/presells`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        title: `Ledger smoke ${stamp}`,
        slug: `ledger-smoke-${stamp}`,
        type: "tsl",
        status: "draft",
        content: {
          title: `Ledger smoke ${stamp}`,
          affiliateLink: OFFER,
          salesText: "Conteúdo informativo E2E smoke.",
          generationNiche: "black",
        },
      }),
    });
    const created = (await createRes.json()) as { id?: string; error?: string };
    const pageId = created.id;
    record(
      steps,
      "presell_draft",
      createRes.status < 300 && Boolean(pageId),
      `http=${createRes.status} ${created.error || pageId || ""}`,
    );
    if (!pageId) throw new Error("presell create failed");

    await prisma.presellPage.update({
      where: { id: pageId },
      data: { status: "published", complianceGate: "ready_for_review" },
    });
    record(steps, "presell_published_bypass_gate", true, pageId);

    const clickRes = await fetch(`${api}/track/r/${pageId}?to=${encodeURIComponent(OFFER)}`, {
      headers: { "user-agent": "Mozilla/5.0 Chrome/124", accept: "application/json" },
      redirect: "manual",
    });
    const location = clickRes.headers.get("location") || "";
    let clickId = "";
    try {
      clickId = new URL(location, OFFER).searchParams.get("clickora_click_id") || "";
    } catch {
      clickId = "";
    }
    record(
      steps,
      "track_r_redirect",
      clickRes.status === 302 && Boolean(clickId),
      `http=${clickRes.status} click=${clickId ? "yes" : "no"}`,
    );
    if (!clickId) throw new Error("sem clickora_click_id");

    const hookInfoRes = await fetch(`${api}/integrations/affiliate-webhook-info`, { headers: auth });
    const hookInfo = (await hookInfoRes.json()) as { hook_url?: string; error?: string; code?: string };
    record(
      steps,
      "webhook_info",
      hookInfoRes.status === 200 && Boolean(hookInfo.hook_url),
      `http=${hookInfoRes.status} ${hookInfo.code || hookInfo.error || "ok"}`,
    );
    if (!hookInfo.hook_url) throw new Error("sem hook_url");

    const saleUrl = new URL(hookInfo.hook_url);
    saleUrl.searchParams.set("platform", "E2E");
    saleUrl.searchParams.set("clickora_click_id", clickId);
    saleUrl.searchParams.set("amount", "12.34");
    saleUrl.searchParams.set("currency", "USD");
    saleUrl.searchParams.set("status", "approved");
    saleUrl.searchParams.set("order_id", `ledger-${stamp}`);
    saleUrl.searchParams.set("product", "smoke_ledger");

    const saleRes = await fetch(saleUrl.toString(), { method: "GET" });
    const saleBody = (await saleRes.json()) as { conversion?: string; error?: string };
    record(
      steps,
      "postback_sale",
      saleRes.status === 200 && saleBody.conversion === "created",
      `http=${saleRes.status} conversion=${saleBody.conversion || saleBody.error || "?"}`,
    );

    const conv = await prisma.conversion.findFirst({
      where: { clickId, externalOrderId: `ledger-${stamp}` },
      select: { id: true, status: true, amount: true },
    });
    record(
      steps,
      "ledger_row",
      Boolean(conv?.id) && Number(conv?.amount) === 12.34,
      conv ? `id=${conv.id} status=${conv.status} amount=${conv.amount}` : "missing",
    );

    // BD efémera CI: cascade limpa clique/conversão com a página.
    await prisma.presellPage.delete({ where: { id: pageId } }).catch(() => undefined);
  } finally {
    await prisma.$disconnect();
  }

  const failed = steps.filter((s) => !s.ok);
  console.log(`\n${steps.length - failed.length}/${steps.length} checks`);
  if (failed.length) {
    console.log("TRACK_LEDGER_SMOKE_FAILED");
    process.exit(1);
  }
  console.log("TRACK_LEDGER_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

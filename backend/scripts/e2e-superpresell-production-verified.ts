/**
 * Selos «E2E Production Verified» — SuperPresell ponta a ponta com sessão.
 *
 * Uso (API + DB alinhados; R2 recomendado em Railway):
 *
 *   cd backend
 *   # .env com DATABASE_URL + JWT_SECRET; API a correr (local ou E2E_API_BASE=prod)
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   npx tsx scripts/e2e-superpresell-production-verified.ts
 *
 * Cria utilizador efémero, corre a cadeia, limpa no finally.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createPostbackToken } from "../src/lib/postbackToken";
import { isR2Configured } from "../src/lib/r2Storage";

const BASE = (process.env.E2E_API_BASE || `http://127.0.0.1:${process.env.PORT || 3001}/api`).replace(
  /\/$/,
  "",
);
const EMAIL = `e2e-spv-${Date.now()}@dclickora.local`;
const PASS = "E2eSpvAudit!99";
const OFFER = "https://www.digistore24.com/redir/e2e-product/demo/";
/** Favicon público estável para teste de rehost. */
const EXT_IMG = "https://www.google.com/favicon.ico";

type Status = "PASS" | "FAIL" | "GAP" | "BLOCKED";
type Row = { id: string; status: Status; detail: string };

const rows: Row[] = [];
const prisma = new PrismaClient();

function rec(id: string, status: Status, detail: string) {
  rows.push({ id, status, detail });
  console.log(`[${status}] ${id} — ${detail}`);
}

async function waitHealth(ms = 45_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(8_000) });
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`API health timeout ${BASE}`);
}

async function ensurePlans() {
  await prisma.plan.upsert({
    where: { id: "plan_free" },
    update: {},
    create: {
      id: "plan_free",
      name: "Starter",
      type: "free_trial",
      priceCents: 0,
      maxPresellPages: 20,
      maxClicksPerMonth: 50_000,
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

function mirrorHtml(extraImg = EXT_IMG) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>E2E Mirror</title></head><body>
<h1>Produto E2E SuperPresell</h1>
<img src="${extraImg}" alt="pack" width="32" height="32">
<a href="${OFFER}">Buy Now</a>
<p>${"x".repeat(220)}</p>
</body></html>`;
}

async function main() {
  console.log(`\n=== E2E Production Verified ===\nAPI=${BASE}\nR2_local_process=${isR2Configured()}\n`);

  await waitHealth();
  await ensurePlans();

  /** 0. Auth gate */
  {
    const r = await fetch(`${BASE}/presells`, { signal: AbortSignal.timeout(15_000) });
    rec(
      "auth.unauthorized",
      r.status === 401 || r.status === 403 ? "PASS" : "FAIL",
      `GET /presells sem token → ${r.status}`,
    );
  }

  const password = await bcrypt.hash(PASS, 10);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      password,
      fullName: "E2E SuperPresell Verified",
      subscription: { create: { planId: "plan_annual", status: "active" } },
      roles: { create: { role: "user" } },
    },
  });
  const userB = await prisma.user.create({
    data: {
      email: `e2e-spv-b-${Date.now()}@dclickora.local`,
      password,
      fullName: "E2E Tenant B",
      subscription: { create: { planId: "plan_annual", status: "active" } },
      roles: { create: { role: "user" } },
    },
  });

  let auth = "";
  let authB = "";
  let pageA = "";
  let pageB = "";
  let rotatorId = "";

  try {
    const login = async (email: string) => {
      const r = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: PASS }),
      });
      const body = (await r.json()) as { token?: string; access_token?: string };
      assert.equal(r.status, 200, `login ${email} ${r.status}`);
      return (body.token || body.access_token)!;
    };
    auth = await login(EMAIL);
    authB = await login(userB.email);
    rec("auth.session", "PASS", "login 200 + token");

    const authHdr = { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" };

    /** Tenant: B não vê lista de A (isolado por token) */
    {
      const r = await fetch(`${BASE}/presells`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      rec("tenant.list_auth", r.status === 200 ? "PASS" : "FAIL", `GET /presells → ${r.status}`);
    }

    /** IMPORT path via create+update (evita Playwright lento em CI) */
    const createPage = async (title: string, type: string, cloak = false) => {
      const slug = `e2e-${title.toLowerCase().replace(/\W+/g, "-")}-${Date.now().toString(36)}`;
      const r = await fetch(`${BASE}/presells`, {
        method: "POST",
        headers: authHdr,
        body: JSON.stringify({
          title,
          slug,
          type,
          status: "published",
          language: "pt-BR",
          content: {
            title,
            affiliateLink: OFFER,
            importMirrorSrcDoc: mirrorHtml(),
            ctaText: "Buy",
          },
          settings: cloak
            ? {
                enterpriseCloak: true,
                cloakSafeTitle: "Safe E2E",
                cloakSafeBody: "Página segura bots/geo.",
                cloakGeoDeny: "CN",
              }
            : {},
          tracking: { offerUrl: OFFER },
        }),
      });
      const body = (await r.json()) as { id?: string; error?: string; content?: Record<string, unknown> };
      assert.ok(r.ok && body.id, `create ${title}: ${r.status} ${JSON.stringify(body)}`);
      return body;
    };

    const createdA = await createPage("Lander A", "tsl");
    pageA = createdA.id!;
    rec("import.create_lander_a", "PASS", `presell A ${pageA.slice(0, 8)}…`);

    /** Mirror presente */
    {
      const mirror = (createdA.content as { importMirrorSrcDoc?: string } | undefined)?.importMirrorSrcDoc;
      const ok = typeof mirror === "string" && mirror.length > 200;
      rec("mirror.persisted", ok ? "PASS" : "FAIL", ok ? `mirror ${mirror!.length} chars` : "mirror em falta");
    }

    /** EDITOR save + REHOST reconciliation */
    {
      const dirty = mirrorHtml(`https://httpbin.org/image/png?e2e=${Date.now()}`);
      const r = await fetch(`${BASE}/presells/${pageA}`, {
        method: "PUT",
        headers: authHdr,
        body: JSON.stringify({
          content: {
            title: "Lander A",
            affiliateLink: OFFER,
            importMirrorSrcDoc: dirty,
            ctaText: "Buy",
          },
        }),
      });
      const body = (await r.json()) as {
        content?: { importMirrorSrcDoc?: string };
        mirror_images_rehosted?: number;
        error?: string;
      };
      assert.ok(r.ok, `update save ${r.status} ${JSON.stringify(body)}`);
      const html = body.content?.importMirrorSrcDoc || "";
      const rehostedCount = body.mirror_images_rehosted ?? 0;
      const hasR2Path = /presell-mirror\//i.test(html);
      if (!isR2Configured() && rehostedCount === 0 && !hasR2Path) {
        // API remota pode ter R2 mesmo se o processo do script não tiver
        if (hasR2Path || rehostedCount > 0) {
          rec("rehost.save_editor", "PASS", `rehosted=${rehostedCount} path=${hasR2Path}`);
        } else {
          // Probe: se API é production railway, R2 should be on — still may fail fetch of httpbin
          rec(
            "rehost.save_editor",
            hasR2Path || rehostedCount > 0 ? "PASS" : "BLOCKED",
            hasR2Path || rehostedCount > 0
              ? `rehosted=${rehostedCount}`
              : `Save OK mas imagem não rehostada (R2 off no servidor ou fetch falhou). mirror_images_rehosted=${rehostedCount}`,
          );
        }
      } else {
        rec(
          "rehost.save_editor",
          hasR2Path || rehostedCount > 0 ? "PASS" : "FAIL",
          `rehosted=${rehostedCount} hasPath=${hasR2Path}`,
        );
      }
      rec("editor.save", "PASS", "PUT /presells/:id com mirror");
    }

    /** RE-IMPORT simulation: update again with fresh external img (same path as re-import+save) */
    {
      const r = await fetch(`${BASE}/presells/${pageA}`, {
        method: "PUT",
        headers: authHdr,
        body: JSON.stringify({
          content: {
            title: "Lander A",
            affiliateLink: OFFER,
            importMirrorSrcDoc: mirrorHtml(EXT_IMG),
            ctaText: "Buy",
          },
        }),
      });
      rec("reimport.save", r.ok ? "PASS" : "FAIL", `re-import via save → ${r.status}`);
    }

    /** CLOAK live */
    {
      await fetch(`${BASE}/presells/${pageA}`, {
        method: "PUT",
        headers: authHdr,
        body: JSON.stringify({
          settings: {
            enterpriseCloak: true,
            cloakSafeTitle: "Safe E2E",
            cloakSafeBody: "Página segura.",
            cloakGeoDeny: "CN",
          },
        }),
      });

      const bot = await fetch(`${BASE}/public/presells/id/${pageA}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
      });
      const botBody = (await bot.json()) as { cloak_safe?: boolean };
      rec(
        "cloak.bot",
        bot.ok && botBody.cloak_safe === true ? "PASS" : "FAIL",
        `bot → cloak_safe=${botBody.cloak_safe} status=${bot.status}`,
      );

      const human = await fetch(`${BASE}/public/presells/id/${pageA}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });
      const humanBody = (await human.json()) as { cloak_safe?: boolean; content?: { importMirrorSrcDoc?: string } };
      const humanOk = human.ok && humanBody.cloak_safe !== true;
      rec(
        "cloak.human",
        humanOk ? "PASS" : "FAIL",
        `human → cloak_safe=${humanBody.cloak_safe} mirror=${Boolean(humanBody.content?.importMirrorSrcDoc)}`,
      );

      // disable cloak for A/B traffic
      await fetch(`${BASE}/presells/${pageA}`, {
        method: "PUT",
        headers: authHdr,
        body: JSON.stringify({ settings: { enterpriseCloak: false } }),
      });
    }

    /** LANDER B + ROTATOR sequential A/B */
    const createdB = await createPage("Lander B", "review");
    pageB = createdB.id!;
    rec("import.create_lander_b", "PASS", `presell B ${pageB.slice(0, 8)}…`);

    const rotSlug = `e2e-ab-${Date.now().toString(36)}`;
    const rotRes = await fetch(`${BASE}/traffic-rotators`, {
      method: "POST",
      headers: authHdr,
      body: JSON.stringify({
        name: "E2E A/B",
        slug: rotSlug,
        mode: "sequential",
        context_presell_id: pageA,
        is_active: true,
        arms: [
          {
            destination_url: `https://example.com/lander-a?pid=${pageA}`,
            label: "A",
            order_index: 0,
            weight: 50,
          },
          {
            destination_url: `https://example.com/lander-b?pid=${pageB}`,
            label: "B",
            order_index: 1,
            weight: 50,
          },
        ],
      }),
    });
    const rotBody = (await rotRes.json()) as {
      id?: string;
      public_click_url?: string;
      error?: string;
      arms?: { id: string; order_index: number }[];
    };
    assert.ok(rotRes.ok && rotBody.id, `rotator ${rotRes.status} ${JSON.stringify(rotBody)}`);
    rotatorId = rotBody.id!;
    rec("rotator.create", "PASS", `rotator ${rotatorId.slice(0, 8)}… sequential`);

    async function rotatorClick(): Promise<{ location: string; parentId: string | null }> {
      const u = `${BASE}/track/rot/${rotatorId}?utm_source=e2e&utm_campaign=spv`;
      const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      assert.equal(r.status, 302, `rot status ${r.status}`);
      const loc = r.headers.get("location") || "";
      let parentId: string | null = null;
      try {
        parentId = new URL(loc).searchParams.get("clickora_click_id");
      } catch {
        /* */
      }
      return { location: loc, parentId };
    }

    const hopA = await rotatorClick();
    const hopB = await rotatorClick();
    rec(
      "rotator.clicks",
      hopA.parentId && hopB.parentId && hopA.parentId !== hopB.parentId ? "PASS" : "FAIL",
      `A parent=${hopA.parentId?.slice(0, 8)} B parent=${hopB.parentId?.slice(0, 8)}`,
    );

    async function offerClick(presellId: string, parentId: string) {
      const u = new URL(`${BASE}/track/r/${presellId}`);
      u.searchParams.set("to", OFFER);
      u.searchParams.set("parent_click_id", parentId);
      u.searchParams.set("utm_source", "e2e");
      const r = await fetch(u.toString(), { redirect: "manual" });
      assert.equal(r.status, 302, `track/r ${r.status}`);
      const loc = r.headers.get("location")!;
      const clickId = new URL(loc).searchParams.get("clickora_click_id");
      assert.ok(clickId, "offer click id");
      return clickId!;
    }

    assert.ok(hopA.parentId && hopB.parentId);
    const saleClickA = await offerClick(pageA, hopA.parentId!);
    const saleClickB = await offerClick(pageB, hopB.parentId!);
    rec("tracking.offer_clicks", "PASS", "CTA A/B com parent_click_id");

    const pbToken = createPostbackToken(user.id);
    async function sale(clickId: string, amount: string) {
      const u = new URL(`${BASE}/integrations/affiliate-webhook`);
      u.searchParams.set("token", pbToken);
      u.searchParams.set("clickora_click_id", clickId);
      u.searchParams.set("amount", amount);
      u.searchParams.set("currency", "USD");
      u.searchParams.set("status", "approved");
      u.searchParams.set("transaction_id", randomUUID());
      const r = await fetch(u.toString());
      const body = (await r.json()) as { ok?: boolean; conversion_id?: string };
      return { status: r.status, body };
    }

    const sA = await sale(saleClickA, "49.00");
    const sB = await sale(saleClickB, "59.00");
    rec(
      "postback.sales",
      sA.status < 400 && sB.status < 400 ? "PASS" : "FAIL",
      `saleA=${sA.status} saleB=${sB.status}`,
    );

    const statsR = await fetch(`${BASE}/traffic-rotators/${rotatorId}/ab-stats?lookback_days=7`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    const stats = (await statsR.json()) as {
      arms?: { label: string | null; clicks: number; conversions: number; revenue: string }[];
      error?: string;
    };
    const arms = stats.arms || [];
    const armA = arms.find((a) => a.label === "A");
    const armB = arms.find((a) => a.label === "B");
    const abOk =
      armA &&
      armB &&
      armA.clicks >= 1 &&
      armB.clicks >= 1 &&
      armA.conversions >= 1 &&
      armB.conversions >= 1;
    rec(
      "abStats.arms",
      abOk ? "PASS" : "FAIL",
      `A c=${armA?.clicks}/cv=${armA?.conversions} B c=${armB?.clicks}/cv=${armB?.conversions} raw=${JSON.stringify(arms)}`,
    );

    /** Analytics authenticated */
    {
      const r = await fetch(`${BASE}/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      rec("analytics.session", r.status === 200 ? "PASS" : "FAIL", `dashboard → ${r.status}`);
    }

    /** Tenant isolation: B cannot update A */
    {
      const r = await fetch(`${BASE}/presells/${pageA}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authB}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "hacked" }),
      });
      rec(
        "tenant.isolation",
        r.status === 404 || r.status === 403 ? "PASS" : "FAIL",
        `B updates A → ${r.status}`,
      );
    }

    /** Public without auth still works for published */
    {
      const r = await fetch(`${BASE}/public/presells/id/${pageA}`);
      rec("public.no_auth", r.status === 200 ? "PASS" : "FAIL", `public GET → ${r.status}`);
    }
  } finally {
    try {
      if (rotatorId) {
        await prisma.trafficRotator.deleteMany({ where: { id: rotatorId } }).catch(() => undefined);
      }
      if (pageA) await prisma.presellPage.deleteMany({ where: { id: pageA } }).catch(() => undefined);
      if (pageB) await prisma.presellPage.deleteMany({ where: { id: pageB } }).catch(() => undefined);
      await prisma.conversion.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
      await prisma.trackingEvent.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userB.id } }).catch(() => undefined);
    } catch (e) {
      console.warn("cleanup", e);
    }
    await prisma.$disconnect();
  }

  const counts = { PASS: 0, FAIL: 0, GAP: 0, BLOCKED: 0 };
  for (const r of rows) counts[r.status]++;
  console.log("\n=== RESUMO ===");
  console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} GAP=${counts.GAP} BLOCKED=${counts.BLOCKED}`);
  const verified = counts.FAIL === 0 && counts.GAP === 0 && counts.BLOCKED === 0;
  console.log(verified ? "SELO: E2E Production Verified" : "SELO: NÃO verificado (ver FAIL/GAP/BLOCKED)");
  console.log("\n__JSON__");
  console.log(JSON.stringify({ api: BASE, counts, verified, rows, ts: new Date().toISOString() }));
  if (!verified) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

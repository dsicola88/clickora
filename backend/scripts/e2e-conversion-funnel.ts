/**
 * E2E ponta-a-ponta do funil + ROI (impressão → clique → checkout → venda).
 *
 * Caminho A (sempre, se DATABASE_URL): seed Prisma → loadConversionFunnel → invariantes
 *   + cruzamento com contagens raw (mesmos filtros KPI).
 *
 * Caminho B (opcional, se E2E_BASE): HTTP GET /api/analytics/funnel com JWT.
 *
 *   cd backend && npx tsx scripts/e2e-conversion-funnel.ts
 *   E2E_BASE=http://127.0.0.1:3001 npx tsx scripts/e2e-conversion-funnel.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { loadConversionFunnel } from "../src/lib/conversionFunnel";

const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function main() {
  const analyticsCtrl = readFileSync(
    join(process.cwd(), "src/controllers/analytics.controller.ts"),
    "utf8",
  );
  const vendas = readFileSync(
    join(process.cwd(), "../frontend/src/pages/Vendas.tsx"),
    "utf8",
  );
  record(
    "getFunnel anexa sync_health; Funil monta SyncHealthBanner",
    analyticsCtrl.includes("...funnel, sync_health") &&
      analyticsCtrl.includes("loadSyncHealth") &&
      vendas.includes("SyncHealthBanner") &&
      vendas.includes("sync_health"),
    "ok",
  );
  const stamp = Date.now().toString(36);
  const email = `e2e-funnel-${stamp}@clickora.test`;
  const passwordHash = await bcrypt.hash("e2e-funnel-pass", 4);
  const userId = randomUUID();
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date(now);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  const paidClickId = randomUUID();
  const organicClickId = randomUUID();
  const botClickId = randomUUID();
  const cloudClickId = randomUUID();
  const untrackedClickId = randomUUID();
  const checkoutLeadId = randomUUID();
  const impressionId = randomUUID();

  await prisma.user.create({
    data: {
      id: userId,
      email,
      password: passwordHash,
      fullName: "E2E Funnel",
    },
  });

  try {
    await prisma.trackingEvent.createMany({
      data: [
        {
          id: impressionId,
          userId,
          eventType: "impression",
          metadata: { utm_term: "emagrecer" },
          createdAt: now,
        },
        {
          id: paidClickId,
          userId,
          eventType: "click",
          source: "google",
          medium: "cpc",
          metadata: {
            gclid: `EAIa_e2e_${stamp}`,
            utm_term: "emagrecer",
            utm_source: "google",
          },
          createdAt: now,
        },
        {
          id: untrackedClickId,
          userId,
          eventType: "click",
          source: "google",
          medium: "cpc",
          metadata: {
            gclid: "{gclid}",
            utm_term: "emagrecer",
            utm_source: "google",
          },
          createdAt: now,
        },
        {
          id: organicClickId,
          userId,
          eventType: "click",
          source: "newsletter",
          medium: "email",
          metadata: { utm_term: "org-kw" },
          createdAt: now,
        },
        {
          id: botClickId,
          userId,
          eventType: "click",
          metadata: { is_bot: true, utm_term: "emagrecer" },
          createdAt: now,
        },
        {
          id: cloudClickId,
          userId,
          eventType: "click",
          metadata: { exclude_from_kpi: true, utm_term: "emagrecer" },
          createdAt: now,
        },
        {
          id: checkoutLeadId,
          userId,
          eventType: "lead",
          metadata: {
            funnel_step: "checkout",
            attributed_click_id: paidClickId,
          },
          createdAt: now,
        },
      ],
    });

    await prisma.conversion.createMany({
      data: [
        {
          userId,
          clickId: paidClickId,
          amount: 25.5,
          currency: "USD",
          status: "approved",
          attribution: "attributed",
          externalOrderId: `e2e-paid-${stamp}`,
          createdAt: now,
        },
        {
          userId,
          clickId: untrackedClickId,
          amount: 10,
          currency: "USD",
          status: "approved",
          attribution: "attributed",
          externalOrderId: `e2e-untracked-${stamp}`,
          createdAt: now,
        },
        {
          userId,
          clickId: organicClickId,
          amount: 8,
          currency: "USD",
          status: "approved",
          attribution: "attributed",
          externalOrderId: `e2e-org-${stamp}`,
          createdAt: now,
        },
        {
          userId,
          clickId: botClickId,
          amount: 99,
          currency: "USD",
          status: "approved",
          attribution: "attributed",
          externalOrderId: `e2e-bot-sale-${stamp}`,
          createdAt: now,
        },
      ],
    });

    const funnel = await loadConversionFunnel({ userId, rangeStart, rangeEnd });

    const byId = Object.fromEntries(funnel.stages.map((s) => [s.id, s.count]));
    record(
      "etapas: 1 impressão, 3 cliques KPI, 1 checkout, 4 vendas (bot sale conta; bot click não)",
      byId.impressions === 1 &&
        byId.clicks === 3 &&
        byId.checkouts === 1 &&
        byId.sales === 4,
      `imp=${byId.impressions} clicks=${byId.clicks} chk=${byId.checkouts} sales=${byId.sales}`,
    );

    record(
      "bot e cloud ficam fora dos cliques KPI",
      byId.clicks === 3,
      "clicks esperados: paid+untracked+organic = 3",
    );

    record(
      "split pago / ads sem ID / orgânico",
      funnel.traffic.paid_sales === 1 &&
        funnel.traffic.paid_untracked_sales === 1 &&
        funnel.traffic.organic_sales === 2 &&
        Math.abs(funnel.traffic.paid_revenue - 25.5) < 0.01 &&
        Math.abs(funnel.traffic.paid_untracked_revenue - 10) < 0.01 &&
        Math.abs(funnel.roi.revenue - 142.5) < 0.01,
      // 25.5+10+8+99 = 142.5 (venda do bot click ainda é venda aprovada)
      `paid=${funnel.traffic.paid_sales}/${funnel.traffic.paid_revenue} untracked=${funnel.traffic.paid_untracked_sales} org=${funnel.traffic.organic_sales} rev=${funnel.roi.revenue}`,
    );

    record(
      "receita = soma dos splits",
      Math.abs(
        funnel.roi.revenue -
          (funnel.traffic.paid_revenue +
            funnel.traffic.paid_untracked_revenue +
            funnel.traffic.organic_revenue),
      ) < 0.02,
      `rev=${funnel.roi.revenue}`,
    );

    const filtered = await loadConversionFunnel({
      userId,
      rangeStart,
      rangeEnd,
      keyword: "emagrecer",
    });
    record(
      "filtro keyword emagrecer: 2 cliques KPI + spend_source != persisted",
      filtered.filter.keyword === "emagrecer" &&
        filtered.stages.find((s) => s.id === "clicks")!.count === 2 &&
        filtered.roi.spend_source !== "persisted",
      `clicks=${filtered.stages.find((s) => s.id === "clicks")!.count} spend_source=${filtered.roi.spend_source}`,
    );

    const rawClickRows = await prisma.$queryRaw<Array<{ ct: bigint }>>`
      SELECT COUNT(*)::bigint AS ct
      FROM tracking_events
      WHERE user_id = ${userId}
        AND event_type::text = 'click'
        AND created_at >= ${rangeStart}
        AND created_at <= ${rangeEnd}
        AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
        AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
    `;
    const rawClicks = Number(rawClickRows[0]?.ct ?? 0);
    record(
      "funnel clicks == SQL KPI (mesmos filtros do dashboard)",
      rawClicks === byId.clicks,
      `sql=${rawClicks} funnel=${byId.clicks}`,
    );

    const dashAligned = await prisma.$queryRaw<
      Array<{ impressions: bigint; clicks: bigint; checkouts: bigint; sales: bigint; revenue: unknown }>
    >`
      SELECT
        (SELECT COUNT(*)::bigint FROM tracking_events
          WHERE user_id = ${userId} AND created_at >= ${rangeStart} AND created_at <= ${rangeEnd}
            AND event_type::text = 'impression'
            AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
            AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
        ) AS impressions,
        (SELECT COUNT(*)::bigint FROM tracking_events
          WHERE user_id = ${userId} AND created_at >= ${rangeStart} AND created_at <= ${rangeEnd}
            AND event_type::text = 'click'
            AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
            AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
        ) AS clicks,
        (SELECT COUNT(*)::bigint FROM tracking_events
          WHERE user_id = ${userId} AND created_at >= ${rangeStart} AND created_at <= ${rangeEnd}
            AND event_type::text = 'lead' AND metadata->>'funnel_step' = 'checkout'
            AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
            AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
        ) AS checkouts,
        (SELECT COUNT(*)::bigint FROM conversions
          WHERE user_id = ${userId} AND created_at >= ${rangeStart} AND created_at <= ${rangeEnd}
            AND status = 'approved'
        ) AS sales,
        (SELECT COALESCE(SUM(amount), 0) FROM conversions
          WHERE user_id = ${userId} AND created_at >= ${rangeStart} AND created_at <= ${rangeEnd}
            AND status = 'approved'
        ) AS revenue
    `;
    const d = dashAligned[0]!;
    record(
      "funnel == contagens canónicas SQL (dashboard-parity)",
      Number(d.impressions) === byId.impressions &&
        Number(d.clicks) === byId.clicks &&
        Number(d.checkouts) === byId.checkouts &&
        Number(d.sales) === byId.sales &&
        Math.abs(Number(d.revenue) - funnel.roi.revenue) < 0.02,
      `sql i/c/k/s/r=${d.impressions}/${d.clicks}/${d.checkouts}/${d.sales}/${d.revenue}`,
    );

    const base = (process.env.E2E_BASE || "").replace(/\/+$/, "");
    if (base) {
      const login = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "e2e-funnel-pass" }),
      });
      const loginBody = (await login.json()) as { token?: string };
      if (!loginBody.token) {
        record("HTTP login para /analytics/funnel", false, `status=${login.status}`);
      } else {
        const from = rangeStart.toISOString().slice(0, 10);
        const to = rangeEnd.toISOString().slice(0, 10);
        const res = await fetch(
          `${base}/api/analytics/funnel?from=${from}&to=${to}`,
          { headers: { authorization: `Bearer ${loginBody.token}` } },
        );
        const body = (await res.json()) as {
          stages?: Array<{ id: string; count: number }>;
          traffic?: { paid_sales: number };
          sync_health?: { period_days?: number; google_ads_failed?: number };
        };
        const httpClicks = body.stages?.find((s) => s.id === "clicks")?.count;
        record(
          "HTTP GET /analytics/funnel alinhado ao loader",
          res.ok && httpClicks === byId.clicks && body.traffic?.paid_sales === 1,
          `status=${res.status} clicks=${httpClicks} paid=${body.traffic?.paid_sales}`,
        );
        record(
          "HTTP funnel inclui sync_health",
          res.ok &&
            body.sync_health != null &&
            typeof body.sync_health.period_days === "number" &&
            typeof body.sync_health.google_ads_failed === "number",
          `sync_health=${JSON.stringify(body.sync_health ?? null)}`,
        );

        const dash = await fetch(
          `${base}/api/analytics/dashboard?from=${from}&to=${to}`,
          { headers: { authorization: `Bearer ${loginBody.token}` } },
        );
        const dashBody = (await dash.json()) as {
          total_clicks?: number;
          total_impressions?: number;
          total_conversions?: number;
          checkout_visitors?: number;
          revenue?: number;
        };
        record(
          "funnel alinhado a dashboard (clicks/imps/vendas/receita)",
          dash.ok &&
            dashBody.total_clicks === byId.clicks &&
            dashBody.total_impressions === byId.impressions &&
            dashBody.total_conversions === byId.sales &&
            Math.abs((dashBody.revenue ?? 0) - funnel.roi.revenue) < 0.02,
          `dash c=${dashBody.total_clicks} i=${dashBody.total_impressions} v=${dashBody.total_conversions} r=${dashBody.revenue} chk=${dashBody.checkout_visitors}`,
        );
        record(
          "checkout funnel == dashboard checkout_visitors",
          (dashBody.checkout_visitors ?? -1) === byId.checkouts,
          `dash_chk=${dashBody.checkout_visitors} funnel_chk=${byId.checkouts}`,
        );
      }
    } else {
      record("HTTP /analytics/funnel (opcional)", true, "skipped — defina E2E_BASE para testar a rota");
    }
  } finally {
    await prisma.conversion.deleteMany({ where: { userId } });
    await prisma.trackingEvent.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

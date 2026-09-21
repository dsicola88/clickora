/**
 * Auditoria real do caminho media-buyer (SQL + ROI).
 * Uso: node --import tsx scripts/audit-media-buyer.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import {
  buildMediaBuyerAlerts,
  campaignUtmSlug,
  computePerf,
  loadCampaignPerf,
} from "../src/lib/campaignPerf";

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='affiliate_campaigns' AND column_name IN ('spend_amount','spend_currency')
     ORDER BY 1`,
  );
  if (cols.length < 2) {
    throw new Error("Colunas spend_* em falta — correr migrate deploy");
  }

  let user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  let createdUser = false;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: `audit-mb-${Date.now()}@clickora.local`,
        password: "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUV",
        fullName: "Audit Media Buyer",
      },
    });
    createdUser = true;
  }
  const uid = user.id;
  const name = `Audit MB ${Date.now()}`;
  const slug = campaignUtmSlug(name);

  const camp = await prisma.affiliateCampaign.create({
    data: {
      userId: uid,
      name,
      trafficSource: "google",
      status: "active",
      spendAmount: new Prisma.Decimal(120),
      spendCurrency: "EUR",
    },
  });

  const now = new Date();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO tracking_events (id, user_id, event_type, campaign, metadata, created_at)
       SELECT gen_random_uuid(), $1::uuid, 'click'::"EventType", $2, jsonb_build_object('utm_campaign', $3), $4
       FROM generate_series(1, 100)`,
      uid,
      name,
      slug,
      now,
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO conversions (id, user_id, status, amount, campaign, metadata, created_at)
       SELECT gen_random_uuid(), $1::uuid, 'approved', 40, $2, jsonb_build_object('utm_campaign', $3, 'platform', 'digistore'), $4
       FROM generate_series(1, 4)`,
      uid,
      name,
      slug,
      now,
    );

    const from = new Date(now.getTime() - 86400000);
    const to = new Date(now.getTime() + 86400000);

    const stats = await loadCampaignPerf({
      userId: uid,
      campaignName: name,
      spend: 120,
      from,
      to,
    });

    const account = computePerf({
      clicks: stats.clicks,
      conversions: stats.conversions,
      revenue: stats.revenue,
      spend: 120,
    });

    const alerts = buildMediaBuyerAlerts({
      clicks: account.clicks,
      conversions: account.conversions,
      revenue: account.revenue,
      spend: 120,
      spendSource: "manual",
    });

    const losing = buildMediaBuyerAlerts({
      clicks: 100,
      conversions: 2,
      revenue: 40,
      spend: 100,
      spendSource: "manual",
    });

    const ok =
      stats.clicks === 100 &&
      stats.conversions === 4 &&
      stats.revenue === 160 &&
      stats.cpa === 30 &&
      stats.roas === 1.33 &&
      stats.profit === 40;

    console.log(
      JSON.stringify(
        {
          spend_columns: cols.map((c) => c.column_name),
          stats,
          expected: { clicks: 100, conversions: 4, revenue: 160, cpa: 30, roas: 1.33, profit: 40 },
          alerts_profitable: alerts.map((a) => a.code),
          alerts_losing_sample: losing.map((a) => a.code),
          ok,
          verdict: ok ? "caminho_sql_roi_ok" : "falha_metricas",
        },
        null,
        2,
      ),
    );

    if (!ok) process.exitCode = 1;
  } finally {
    await prisma.conversion.deleteMany({ where: { userId: uid, campaign: name } });
    await prisma.trackingEvent.deleteMany({ where: { userId: uid, campaign: name } });
    await prisma.affiliateCampaign.delete({ where: { id: camp.id } }).catch(() => undefined);
    if (createdUser) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => undefined);
    }
  }
}

main()
  .catch((e) => {
    console.error("FAIL", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

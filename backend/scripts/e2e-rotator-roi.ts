/**
 * E2E ROI rotadores: alocação de custo ∝ cliques raiz + invariantes.
 *
 *   cd backend && npx tsx scripts/e2e-rotator-roi.ts
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  allocatePeriodSpendByClicks,
  sumAllocatedCost,
} from "../src/lib/allocateSpendByClicks";
import { loadConversionFunnel } from "../src/lib/conversionFunnel";

const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function main() {
  const stamp = Date.now().toString(36);
  const userId = randomUUID();
  const rotatorId = randomUUID();
  const armA = randomUUID();
  const armB = randomUUID();
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date(now);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  await prisma.user.create({
    data: {
      id: userId,
      email: `e2e-rot-roi-${stamp}@clickora.test`,
      password: await bcrypt.hash("e2e-rot-roi", 4),
      fullName: "E2E Rotator ROI",
    },
  });

  const contextPresellId = randomUUID();
  try {
    await prisma.presellPage.create({
      data: {
        id: contextPresellId,
        userId,
        title: "E2E Rot ROI",
        slug: `e2e-rot-roi-${stamp}`,
        type: "tsl",
        status: "published",
        content: { title: "E2E", affiliateLink: "https://offer.example/go" },
      },
    });

    await prisma.trafficRotator.create({
      data: {
        id: rotatorId,
        userId,
        name: "E2E Rot",
        slug: `e2e-rot-${stamp}`,
        mode: "weighted",
        contextPresellId,
        arms: {
          create: [
            { id: armA, destinationUrl: "https://a.example", label: "A", orderIndex: 0, weight: 50 },
            { id: armB, destinationUrl: "https://b.example", label: "B", orderIndex: 1, weight: 50 },
          ],
        },
      },
    });

    const clickA = randomUUID();
    const clickB = randomUUID();
    const clickDirect = randomUUID();

    await prisma.trackingEvent.createMany({
      data: [
        {
          id: clickA,
          userId,
          eventType: "click",
          metadata: {
            rotator_id: rotatorId,
            rotator_arm_id: armA,
            rotator_arm_label: "A",
          },
          createdAt: now,
        },
        {
          id: clickB,
          userId,
          eventType: "click",
          metadata: {
            rotator_id: rotatorId,
            rotator_arm_id: armB,
            rotator_arm_label: "B",
          },
          createdAt: now,
        },
        {
          id: clickDirect,
          userId,
          eventType: "click",
          metadata: { utm_source: "direct" },
          createdAt: now,
        },
        {
          id: randomUUID(),
          userId,
          eventType: "click",
          metadata: {
            rotator_id: rotatorId,
            rotator_arm_id: armA,
            parent_rotator_click_id: clickA,
          },
          createdAt: now,
        },
      ],
    });

    await prisma.conversion.create({
      data: {
        userId,
        clickId: clickA,
        amount: 40,
        currency: "USD",
        status: "approved",
        attribution: "attributed",
        externalOrderId: `e2e-rot-${stamp}`,
        createdAt: now,
      },
    });

    /** 3 entry clicks (A, B, direct); hop filho não conta. Spend 30 → pool rotador = 20 (2/3). */
    const rotRows = allocatePeriodSpendByClicks(
      [
        { rotator_id: rotatorId, clicks: 2, revenue: 40 },
      ],
      30,
      3,
    );
    record(
      "alocação rotador: 2/3 do spend",
      rotRows[0]!.cost === 20 && rotRows[0]!.profit === 20 && rotRows[0]!.roas === 2,
      `cost=${rotRows[0]!.cost} profit=${rotRows[0]!.profit} roas=${rotRows[0]!.roas}`,
    );

    const armRows = allocatePeriodSpendByClicks(
      [
        { arm_id: armA, clicks: 1, revenue: 40 },
        { arm_id: armB, clicks: 1, revenue: 0 },
      ],
      30,
      3,
    );
    record(
      "alocação braços: 10+10 = pool 20",
      armRows[0]!.cost === 10 &&
        armRows[1]!.cost === 10 &&
        sumAllocatedCost(armRows) === 20 &&
        armRows[0]!.profit === 30 &&
        armRows[1]!.profit === -10,
      `A=${armRows[0]!.cost}/${armRows[0]!.profit} B=${armRows[1]!.cost}/${armRows[1]!.profit}`,
    );

    record(
      "sem spend → null (não inventa)",
      allocatePeriodSpendByClicks([{ clicks: 2, revenue: 40 }], null, 3)[0]!.cost === null,
      "ok",
    );

    /** Contagens KPI alinhadas ao funil (entry hops = 3 cliques raiz + 1 hop = 4 clicks totais no tipo click). */
    const funnel = await loadConversionFunnel({ userId, rangeStart, rangeEnd });
    const clicks = funnel.stages.find((s) => s.id === "clicks")?.count ?? -1;
    const sales = funnel.stages.find((s) => s.id === "sales")?.count ?? -1;
    record(
      "funnel conta hop+raiz e a venda do braço A",
      clicks === 4 && sales === 1 && funnel.roi.revenue === 40,
      `clicks=${clicks} sales=${sales} rev=${funnel.roi.revenue}`,
    );

    const entryRaw = await prisma.$queryRaw<Array<{ ct: bigint }>>`
      SELECT COUNT(*)::bigint AS ct
      FROM tracking_events
      WHERE user_id = ${userId}
        AND event_type::text = 'click'
        AND metadata->>'parent_rotator_click_id' IS NULL
        AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
        AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
    `;
    const entry = Number(entryRaw[0]?.ct ?? 0);
    record("entry clicks SQL = 3 (sem hop filho)", entry === 3, `entry=${entry}`);

    const rotSql = await prisma.$queryRaw<Array<{ clicks: bigint; sales: bigint; revenue: unknown }>>`
      SELECT COUNT(*)::bigint AS clicks,
             COUNT(c.id)::bigint AS sales,
             COALESCE(SUM(c.amount), 0) AS revenue
      FROM tracking_events te
      LEFT JOIN conversions c
        ON c.click_id = te.id AND c.user_id = te.user_id AND c.status = 'approved'
      WHERE te.user_id = ${userId}
        AND te.event_type::text = 'click'
        AND NULLIF(TRIM(te.metadata->>'rotator_id'), '') IS NOT NULL
        AND te.metadata->>'parent_rotator_click_id' IS NULL
        AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
        AND NOT COALESCE((te.metadata->>'exclude_from_kpi') = 'true', false)
    `;
    record(
      "SQL rotador raiz: 2 cliques, 1 venda, receita 40",
      Number(rotSql[0]?.clicks) === 2 &&
        Number(rotSql[0]?.sales) === 1 &&
        Number(rotSql[0]?.revenue) === 40,
      `c=${rotSql[0]?.clicks} s=${rotSql[0]?.sales} r=${rotSql[0]?.revenue}`,
    );

    const allocatedFromSql = allocatePeriodSpendByClicks(
      [
        {
          clicks: Number(rotSql[0]?.clicks ?? 0),
          revenue: Number(rotSql[0]?.revenue ?? 0),
        },
      ],
      30,
      entry,
    );
    record(
      "SQL→alocação igual ao contrato (cost 20)",
      allocatedFromSql[0]!.cost === 20,
      `cost=${allocatedFromSql[0]!.cost}`,
    );
  } finally {
    await prisma.conversion.deleteMany({ where: { userId } });
    await prisma.trackingEvent.deleteMany({ where: { userId } });
    await prisma.trafficRotatorArm.deleteMany({ where: { rotatorId } }).catch(() => undefined);
    await prisma.trafficRotator.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.presellPage.deleteMany({ where: { userId } }).catch(() => undefined);
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

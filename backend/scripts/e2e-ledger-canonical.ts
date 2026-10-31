/**
 * FASE 1 — evidência do ledger canónico contra DB de auditoria (nunca produção).
 *
 *   set -a && source .env.audit-fase-b && set +a
 *   npx tsx scripts/e2e-ledger-canonical.ts
 *
 * Critérios: Conversion = receita; TE não duplica; dedupe/race/refund/pending;
 * totais analytics-equivalentes (sumApproved) = export Offline GCLID; isolamento tenant.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { assertLocalDatabaseForMutations } from "./lib/loadTestSafety";
import { systemPrisma } from "../src/lib/prisma";
import {
  listApprovedConversionsWithGclid,
  offlineCsvExternalOrderId,
  reconcileConversionLedger,
  sumApprovedConversionTotals,
  upsertConversionFromOfflineCsv,
} from "../src/lib/conversionLedger";
import {
  adsExternalOrderId,
  upsertConversionFromAdsPostback,
} from "../src/lib/unifiedAdsConversion";

assertLocalDatabaseForMutations();

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  — ${detail}`);
}

async function seedUser(tag: string) {
  const email = `ledger-${tag}-${Date.now().toString(36)}@audit.clickora.test`;
  const user = await systemPrisma.user.create({
    data: {
      email,
      password: createHash("sha256").update(`x-${tag}`).digest("hex"),
      fullName: `Ledger ${tag}`,
    },
    select: { id: true, email: true },
  });
  const page = await systemPrisma.presellPage.create({
    data: {
      userId: user.id,
      title: `Ledger page ${tag}`,
      slug: `ledger-${tag}-${randomUUID().slice(0, 8)}`,
      type: "tsl",
      status: "published",
      content: { title: "Ledger", affiliateLink: "https://offer.example/go" },
    },
    select: { id: true },
  });
  return { user, page };
}

async function seedClick(args: {
  userId: string;
  pageId: string;
  gclid?: string;
  campaign?: string;
}) {
  return systemPrisma.trackingEvent.create({
    data: {
      userId: args.userId,
      presellPageId: args.pageId,
      eventType: "click",
      source: "google",
      medium: "cpc",
      campaign: args.campaign ?? "camp-ledger",
      metadata: {
        gclid: args.gclid ?? null,
      },
    },
    select: { id: true },
  });
}

async function main() {
  const stamp = Date.now().toString(36);
  const a = await seedUser(`a-${stamp}`);
  const b = await seedUser(`b-${stamp}`);
  const rangeStart = new Date(Date.now() - 60_000);
  const rangeEnd = new Date(Date.now() + 60_000);

  const clickA = await seedClick({
    userId: a.user.id,
    pageId: a.page.id,
    gclid: `gclid-a-${stamp}`,
    campaign: "camp-a",
  });

  // 1) Postback uma vez
  const once = await upsertConversionFromAdsPostback({
    userId: a.user.id,
    presellId: a.page.id,
    clickId: clickA.id,
    amount: 21.5,
    currency: "USD",
    campaign: "camp-a",
    origin: "google_ads",
    transactionId: `TX-ONCE-${stamp}`,
    adClickId: `gclid-a-${stamp}`,
  });
  record("1_postback_once", once.created && !once.duplicate, `id=${once.conversionId}`);

  // 2) Mesmo postback várias vezes
  const twice = await upsertConversionFromAdsPostback({
    userId: a.user.id,
    presellId: a.page.id,
    clickId: clickA.id,
    amount: 21.5,
    currency: "USD",
    campaign: "camp-a",
    origin: "google_ads",
    transactionId: `TX-ONCE-${stamp}`,
    adClickId: `gclid-a-${stamp}`,
  });
  const countTx = await systemPrisma.conversion.count({
    where: {
      userId: a.user.id,
      externalOrderId: adsExternalOrderId("google_ads", `TX-ONCE-${stamp}`),
    },
  });
  record(
    "2_postback_repeat",
    twice.duplicate && countTx === 1,
    `duplicate=${twice.duplicate} rows=${countTx}`,
  );

  // 3) Dois simultâneos mesma conversão
  const raceTx = `TX-RACE-${stamp}`;
  const raceResults = await Promise.all(
    [0, 1].map(() =>
      upsertConversionFromAdsPostback({
        userId: a.user.id,
        presellId: a.page.id,
        clickId: clickA.id,
        amount: 9,
        currency: "USD",
        campaign: "camp-a",
        origin: "google_ads",
        transactionId: raceTx,
        adClickId: `gclid-a-${stamp}`,
      }),
    ),
  );
  const raceCreated = raceResults.filter((r) => r.created).length;
  const raceDup = raceResults.filter((r) => r.duplicate).length;
  const raceCount = await systemPrisma.conversion.count({
    where: { userId: a.user.id, externalOrderId: adsExternalOrderId("google_ads", raceTx) },
  });
  record(
    "3_concurrent_race",
    raceCount === 1 && raceCreated === 1 && raceDup === 1,
    `created=${raceCreated} dup=${raceDup} rows=${raceCount}`,
  );

  // 4) IDs externos diferentes, mesmo GCLID de negócio (CSV)
  const gclidBiz = `gclid-biz-${stamp}`;
  const clickBiz = await seedClick({
    userId: a.user.id,
    pageId: a.page.id,
    gclid: gclidBiz,
    campaign: "camp-csv",
  });
  const csv1 = await upsertConversionFromOfflineCsv({
    userId: a.user.id,
    presellId: a.page.id,
    clickId: clickBiz.id,
    amount: 33,
    gclid: gclidBiz,
    campaign: "camp-csv",
  });
  const csv2 = await upsertConversionFromOfflineCsv({
    userId: a.user.id,
    presellId: a.page.id,
    clickId: clickBiz.id,
    amount: 99,
    gclid: gclidBiz,
    campaign: "camp-csv",
  });
  const csvRows = await systemPrisma.conversion.count({
    where: { userId: a.user.id, externalOrderId: offlineCsvExternalOrderId(gclidBiz) },
  });
  record(
    "4_same_business_key_csv",
    csv1.created && csv2.duplicate && csvRows === 1,
    `ext=${offlineCsvExternalOrderId(gclidBiz)} rows=${csvRows}`,
  );

  // 5) Reembolso
  const beforeRefund = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  const refundTarget = await systemPrisma.conversion.create({
    data: {
      userId: a.user.id,
      presellId: a.page.id,
      clickId: clickA.id,
      amount: new Prisma.Decimal(40),
      currency: "USD",
      status: "approved",
      attribution: "attributed",
      externalOrderId: `aff-refund-${stamp}`,
      campaign: "camp-a",
      metadata: { platform: "buygoods" },
    },
  });
  const withRefundSale = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  await systemPrisma.conversion.update({
    where: { id: refundTarget.id },
    data: {
      status: "refunded",
      metadata: {
        platform: "buygoods",
        refunded_at: new Date().toISOString(),
        refund_kind: "refund",
      },
    },
  });
  const afterRefund = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  const refundStillApproved = await systemPrisma.conversion.findFirst({
    where: { id: refundTarget.id, status: "approved" },
  });
  record(
    "5_refunded",
    !refundStillApproved &&
      Math.abs(withRefundSale.revenue - beforeRefund.revenue - 40) < 0.001 &&
      Math.abs(afterRefund.revenue - beforeRefund.revenue) < 0.001,
    `before=${beforeRefund.revenue} +40→${withRefundSale.revenue} refund→${afterRefund.revenue}`,
  );

  // 6) Cancelamento pending
  const pendingCancel = await systemPrisma.conversion.create({
    data: {
      userId: a.user.id,
      presellId: a.page.id,
      amount: new Prisma.Decimal(77),
      currency: "USD",
      status: "pending",
      attribution: "unattributed",
      externalOrderId: `aff-cancel-${stamp}`,
    },
  });
  await systemPrisma.conversion.update({
    where: { id: pendingCancel.id },
    data: { status: "refunded", metadata: { cancelled_from_pending: true } },
  });
  const cancelInRevenue = await systemPrisma.conversion.count({
    where: { id: pendingCancel.id, status: "approved" },
  });
  record("6_cancelled_pending", cancelInRevenue === 0, "pending cancel → refunded, $0");

  // 7) Pending → approved
  const pendingUp = await systemPrisma.conversion.create({
    data: {
      userId: a.user.id,
      presellId: a.page.id,
      clickId: clickA.id,
      amount: new Prisma.Decimal(15),
      currency: "USD",
      status: "pending",
      attribution: "attributed",
      externalOrderId: `aff-pending-${stamp}`,
      campaign: "camp-a",
    },
  });
  const beforeUp = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  await systemPrisma.conversion.update({
    where: { id: pendingUp.id },
    data: { status: "approved", metadata: { approved_from_pending_at: new Date().toISOString() } },
  });
  const afterUp = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  record(
    "7_pending_to_approved",
    Math.abs(afterUp.revenue - beforeUp.revenue - 15) < 0.001 && afterUp.count === beforeUp.count + 1,
    `Δrevenue=${afterUp.revenue - beforeUp.revenue} Δcount=${afterUp.count - beforeUp.count}`,
  );

  // 8) Dashboard (= sumApproved) vs CSV de vendas (= listConversions: todas approved)
  const dashboard = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  const salesCsvRows = await systemPrisma.conversion.findMany({
    where: {
      userId: a.user.id,
      status: "approved",
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: { id: true, amount: true },
  });
  const salesCsvCount = salesCsvRows.length;
  const salesCsvRevenue = salesCsvRows.reduce(
    (s, r) => s + (r.amount != null ? Number(r.amount) : 0),
    0,
  );
  record(
    "8a_dashboard_vs_sales_csv_count",
    dashboard.count === salesCsvCount,
    `dashboard.count=${dashboard.count} sales_csv.count=${salesCsvCount}`,
  );
  record(
    "8b_dashboard_vs_sales_csv_revenue",
    Math.abs(dashboard.revenue - salesCsvRevenue) < 0.001,
    `dashboard.revenue=${dashboard.revenue} sales_csv.revenue=${salesCsvRevenue}`,
  );

  // Offline Google CSV (só GCLID) alinhado ao subconjunto com GCLID do ledger
  const exportRows = await listApprovedConversionsWithGclid({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  const exportSum = exportRows.reduce((s, r) => s + r.value, 0);
  const withGclid = await systemPrisma.conversion.findMany({
    where: {
      userId: a.user.id,
      status: "approved",
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      amount: true,
      metadata: true,
      click: { select: { metadata: true } },
    },
  });
  let expectedExport = 0;
  for (const c of withGclid) {
    const clickMeta = (c.click?.metadata || {}) as Record<string, unknown>;
    const own = (c.metadata || {}) as Record<string, unknown>;
    const g =
      (typeof clickMeta.gclid === "string" && clickMeta.gclid) ||
      (typeof own.gclid === "string" && own.gclid) ||
      "";
    if (g) expectedExport += c.amount != null ? Number(c.amount) : 0;
  }
  record(
    "8c_offline_gclid_csv_vs_ledger_subset",
    Math.abs(exportSum - expectedExport) < 0.001,
    `offline_csv=${exportSum} expected=${expectedExport} rows=${exportRows.length}`,
  );

  // 9) Filtros campanha / presell / período
  const byCamp = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
    campaign: "camp-csv",
  });
  const byPresell = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
    presellId: a.page.id,
  });
  const emptyPeriod = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart: new Date("2000-01-01"),
    rangeEnd: new Date("2000-01-02"),
  });
  record(
    "9_filters_campaign_presell_period",
    byCamp.revenue === 33 && byPresell.count >= 1 && emptyPeriod.count === 0,
    `camp-csv=${byCamp.revenue} presell_count=${byPresell.count} empty=${emptyPeriod.count}`,
  );

  // 10) Isolamento tenants
  const clickB = await seedClick({
    userId: b.user.id,
    pageId: b.page.id,
    gclid: `gclid-b-${stamp}`,
    campaign: "camp-b",
  });
  await upsertConversionFromAdsPostback({
    userId: b.user.id,
    presellId: b.page.id,
    clickId: clickB.id,
    amount: 1000,
    currency: "USD",
    campaign: "camp-b",
    origin: "google_ads",
    transactionId: `TX-TENANT-B-${stamp}`,
    adClickId: `gclid-b-${stamp}`,
  });
  const totalsA = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  const totalsB = await sumApprovedConversionTotals({
    userId: b.user.id,
    rangeStart,
    rangeEnd,
  });
  const leak = await systemPrisma.conversion.count({
    where: { userId: a.user.id, externalOrderId: adsExternalOrderId("google_ads", `TX-TENANT-B-${stamp}`) },
  });
  record(
    "10_tenant_isolation",
    leak === 0 && totalsB.revenue === 1000 && totalsA.revenue !== 1000,
    `A.revenue=${totalsA.revenue} B.revenue=${totalsB.revenue} leak=${leak}`,
  );

  // 11) Falha na gravação (amount inválido / constraint) — sem linha fantasma
  let failed = false;
  const beforeFail = await systemPrisma.conversion.count({ where: { userId: a.user.id } });
  try {
    await systemPrisma.conversion.create({
      data: {
        userId: a.user.id,
        amount: new Prisma.Decimal(1),
        status: "approved",
        attribution: "attributed",
        /** Força P2002 no mesmo external já usado */
        externalOrderId: adsExternalOrderId("google_ads", `TX-ONCE-${stamp}`),
      },
    });
  } catch (e) {
    failed = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
  }
  const afterFail = await systemPrisma.conversion.count({ where: { userId: a.user.id } });
  record("11_write_failure_no_ghost", failed && afterFail === beforeFail, `P2002=${failed}`);

  // 12) Reprocessamento seguro após falha (retry = duplicate)
  const reproc = await upsertConversionFromAdsPostback({
    userId: a.user.id,
    presellId: a.page.id,
    clickId: clickA.id,
    amount: 21.5,
    currency: "USD",
    origin: "google_ads",
    transactionId: `TX-ONCE-${stamp}`,
    adClickId: `gclid-a-${stamp}`,
  });
  record("12_safe_reprocess", reproc.duplicate === true, `duplicate=${reproc.duplicate}`);

  // TE telemetria offline_csv não pode ultrapassar Conversion
  await systemPrisma.trackingEvent.create({
    data: {
      userId: a.user.id,
      presellPageId: a.page.id,
      eventType: "conversion",
      source: "google_ads",
      medium: "offline_csv",
      metadata: {
        gclid: gclidBiz,
        value: 33,
        postback_origin: "offline_csv",
        transaction_id: `csv_gclid:${gclidBiz}`,
        ledger: "telemetry_only",
      },
    },
  });
  const recon = await reconcileConversionLedger({
    userId: a.user.id,
    since: rangeStart,
  });
  record(
    "reconcile_csv_aligned",
    recon.ledger_aligned && recon.conversion_offline_csv >= recon.te_offline_csv,
    recon.note,
  );

  // Snapshot para checklist de aceitação (antes do cleanup)
  const dashFinal = await sumApprovedConversionTotals({
    userId: a.user.id,
    rangeStart,
    rangeEnd,
  });
  const csvFinalRows = await systemPrisma.conversion.findMany({
    where: {
      userId: a.user.id,
      status: "approved",
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    select: { amount: true },
  });
  const csvFinalRev = csvFinalRows.reduce(
    (s, r) => s + (r.amount != null ? Number(r.amount) : 0),
    0,
  );
  const refundedRow = await systemPrisma.conversion.findUnique({
    where: { id: refundTarget.id },
    select: { status: true, amount: true },
  });
  const cancelledRow = await systemPrisma.conversion.findUnique({
    where: { id: pendingCancel.id },
    select: { status: true },
  });
  const foreignProbe = await systemPrisma.conversion.findMany({
    where: { userId: a.user.id, externalOrderId: adsExternalOrderId("google_ads", `TX-TENANT-B-${stamp}`) },
  });
  const raceStillOne = await systemPrisma.conversion.count({
    where: { userId: a.user.id, externalOrderId: adsExternalOrderId("google_ads", raceTx) },
  });
  const onceStillOne = await systemPrisma.conversion.count({
    where: { userId: a.user.id, externalOrderId: adsExternalOrderId("google_ads", `TX-ONCE-${stamp}`) },
  });

  const checklist: Array<{ label: string; ok: boolean; evidence: string }> = [
    {
      label: "Dashboard e CSV apresentam exatamente o mesmo número de conversões.",
      ok: dashFinal.count === csvFinalRows.length,
      evidence: `dashboard=${dashFinal.count} sales_csv=${csvFinalRows.length}`,
    },
    {
      label: "Dashboard e CSV apresentam exatamente a mesma receita.",
      ok: Math.abs(dashFinal.revenue - csvFinalRev) < 0.001,
      evidence: `dashboard=${dashFinal.revenue} sales_csv=${csvFinalRev}`,
    },
    {
      label: "Postback repetido não duplica uma venda.",
      ok: onceStillOne === 1 && results.find((r) => r.name === "2_postback_repeat")?.ok === true,
      evidence: `rows_for_TX-ONCE=${onceStillOne}`,
    },
    {
      label: "Dois postbacks simultâneos não criam duas vendas.",
      ok: raceStillOne === 1 && results.find((r) => r.name === "3_concurrent_race")?.ok === true,
      evidence: `rows_for_TX-RACE=${raceStillOne}`,
    },
    {
      label: "Reembolso reduz corretamente a receita considerada válida.",
      ok: refundedRow?.status === "refunded" && results.find((r) => r.name === "5_refunded")?.ok === true,
      evidence: `status=${refundedRow?.status} amount=${refundedRow?.amount}`,
    },
    {
      label: "Cancelamento atualiza o estado financeiro.",
      ok: cancelledRow?.status === "refunded",
      evidence: `pending_cancel_status=${cancelledRow?.status}`,
    },
    {
      label: "Uma conta não consegue consultar conversões de outra.",
      ok: foreignProbe.length === 0 && results.find((r) => r.name === "10_tenant_isolation")?.ok === true,
      evidence: `foreign_rows_in_A=${foreignProbe.length} B.revenue=1000`,
    },
    {
      label: "Todos os testes passam na base de dados isolada.",
      ok: results.every((r) => r.ok),
      evidence: `db=${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@")} pass=${results.filter((r) => r.ok).length}/${results.length}`,
    },
  ];

  console.log("\n=== ACCEPTANCE CHECKLIST (audit DB) ===");
  for (const item of checklist) {
    console.log(`${item.ok ? "[x]" : "[ ]"} ${item.label}`);
    console.log(`    evidence: ${item.evidence}`);
  }
  const checklistFail = checklist.filter((c) => !c.ok).length;

  // Cleanup scoped seed (não DROP indiscriminado)
  await systemPrisma.conversion.deleteMany({
    where: { userId: { in: [a.user.id, b.user.id] } },
  });
  await systemPrisma.trackingEvent.deleteMany({
    where: { userId: { in: [a.user.id, b.user.id] } },
  });
  await systemPrisma.presellPage.deleteMany({
    where: { userId: { in: [a.user.id, b.user.id] } },
  });
  await systemPrisma.user.deleteMany({
    where: { id: { in: [a.user.id, b.user.id] } },
  });

  const failedN = results.filter((r) => !r.ok).length;
  console.log("\n--- FASE1 ledger canonical ---");
  console.log(`pass=${results.length - failedN} fail=${failedN} checklist_fail=${checklistFail}`);
  if (failedN > 0 || checklistFail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

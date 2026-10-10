/**
 * Prova E2E em staging local. Recusa qualquer base que não seja
 * 127.0.0.1:5434/clickora_e2e_audit. Não apaga linhas.
 *
 * DATABASE_URL=postgresql://clickora@127.0.0.1:5434/clickora_e2e_audit?schema=public \
 * JWT_SECRET=e2e-staging-secret NODE_ENV=test E2E_AD_MOCK=1 \
 * META_CAPI_GRAPH_ORIGIN=http://127.0.0.1:3019 \
 * TIKTOK_EVENTS_TRACK_URL=http://127.0.0.1:3019/tiktok \
 * npx tsx scripts/e2e-staging-affiliate-audit.ts
 */
import http from "node:http";
import { createCipheriv, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createPostbackToken } from "../src/lib/postbackToken";
import { jvzooExpectedCverify } from "../src/lib/affiliatePlatforms/parseAffiliatePostback";
import { clickbankInsKey } from "../src/lib/affiliatePlatforms/clickbankIns";
import { integrationsController } from "../src/controllers/integrations.controller";
import { runWithTenantContext } from "../src/lib/tenantContext";
import { retractConversionFromMetaCapi } from "../src/modules/metaCapi/metaCapi.service";

const STAGING_URL = "postgresql://clickora@127.0.0.1:5434/clickora_e2e_audit?schema=public";

type Hit = { path: string; event: string; value: number | null; eventId: string | null };

const hits: Hit[] = [];
const results: { id: string; name: string; pass: boolean; detail: string }[] = [];

function record(id: string, name: string, pass: boolean, detail: string) {
  results.push({ id, name, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id} ${name} — ${detail}`);
}

function assertStagingEnv() {
  const raw = process.env.DATABASE_URL || "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL ausente ou inválida. Staging não confirmado.");
  }
  if (url.hostname !== "127.0.0.1" || url.port !== "5434" || url.pathname !== "/clickora_e2e_audit") {
    throw new Error(`Recusado: ${url.hostname}:${url.port}${url.pathname}`);
  }
  if (/rlwy|railway/i.test(raw)) throw new Error("Recusado: URL com Railway.");
  if (process.env.NODE_ENV === "production") throw new Error("Recusado: NODE_ENV=production.");
  if (raw !== STAGING_URL) throw new Error("Recusado: DATABASE_URL não é a staging descartável.");
  delete process.env.GOOGLE_ADS_REFRESH_TOKEN;
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  delete process.env.GOOGLE_ADS_CLIENT_SECRET;
}

async function confirmDatabase(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<
    { db: string; port: number; addr: string }[]
  >("SELECT current_database() AS db, inet_server_port() AS port, inet_server_addr()::text AS addr");
  const row = rows[0];
  if (!row || row.db !== "clickora_e2e_audit" || Number(row.port) !== 5434 || !String(row.addr).startsWith("127.0.0.1")) {
    throw new Error(`Ligação inesperada: ${JSON.stringify(row)}`);
  }
  console.log(`STAGING_OK db=${row.db} addr=${row.addr} port=${row.port}`);
}

function startMock(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      let event = "unknown";
      let value: number | null = null;
      let eventId: string | null = null;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          data?: { event_name?: string; event?: string; event_id?: string; custom_data?: { value?: number }; properties?: { value?: number } }[];
        };
        const row = body.data?.[0];
        event = row?.event_name || row?.event || "unknown";
        eventId = row?.event_id || null;
        const rawValue = row?.custom_data?.value ?? row?.properties?.value;
        value = typeof rawValue === "number" ? rawValue : null;
      } catch {
        event = "unparsed";
      }
      hits.push({ path: req.url?.split("?")[0] || "", event, value, eventId });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ events_received: 1, code: 0, message: "OK" }));
    });
  });
  return new Promise((resolve) => {
    server.listen(3019, "127.0.0.1", () => resolve(server));
  });
}

function clickbankEnvelope(plaintext: string, secret: string) {
  const key = clickbankInsKey(secret);
  const iv = randomBytes(16);
  const pad = (16 - (Buffer.byteLength(plaintext) % 16)) % 16;
  const padded = Buffer.concat([Buffer.from(plaintext, "utf8"), Buffer.alloc(pad)]);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  const data = Buffer.concat([cipher.update(padded), cipher.final()]);
  return { notification: data.toString("base64"), iv: iv.toString("base64") };
}

async function post(token: string, query: Record<string, string>, body: Record<string, string> = {}) {
  const req = {
    query: { token, ...query },
    body,
    headers: { "user-agent": "e2e-staging" },
  } as unknown as Request;
  let statusCode = 200;
  let payload: Record<string, unknown> | null = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: Record<string, unknown>) {
      payload = data;
      return this;
    },
  } as unknown as Response;
  await integrationsController.affiliateWebhook(req, res);
  return { statusCode, payload: payload || {} };
}

async function waitFor(fn: () => Promise<boolean>, label: string) {
  for (let i = 0; i < 30; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  assertStagingEnv();
  const prisma = new PrismaClient();
  const server = await startMock();
  const run = Date.now().toString(36);
  try {
    await confirmDatabase(prisma);
    const plan = await prisma.plan.upsert({
      where: { id: "plan_e2e_staging" },
      update: { affiliateWebhookEnabled: true },
      create: {
        id: "plan_e2e_staging",
        name: "Staging E2E",
        type: "annual",
        priceCents: 0,
        affiliateWebhookEnabled: true,
        features: [],
      },
    });
    const password = await bcrypt.hash("staging-only", 4);

    async function makeAccount(label: string, ads: { meta?: boolean; tiktok?: boolean; google?: boolean }) {
      const user = await prisma.user.create({
        data: {
          email: `e2e-${label}-${run}@staging.local`,
          password,
          fullName: label,
          metaCapiEnabled: Boolean(ads.meta),
          metaPixelId: ads.meta ? "111111111111111" : null,
          metaAccessToken: ads.meta ? "mock-meta-token" : null,
          tiktokEventsEnabled: Boolean(ads.tiktok),
          tiktokPixelId: ads.tiktok ? "TIKTOKPIXEL" : null,
          tiktokEventsAccessToken: ads.tiktok ? "mock-tiktok-token" : null,
          googleAdsEnabled: Boolean(ads.google),
          googleAdsCustomerId: ads.google ? "1234567890" : null,
          googleAdsConversionActionId: ads.google ? "999" : null,
        },
      });
      await prisma.subscription.create({
        data: { userId: user.id, planId: plan.id, status: "active" },
      });
      const presell = await prisma.presellPage.create({
        data: {
          userId: user.id,
          title: `Presell ${label}`,
          slug: `e2e-${label}-${run}`,
          status: "published",
        },
      });
      const click = await prisma.trackingEvent.create({
        data: {
          userId: user.id,
          presellPageId: presell.id,
          eventType: "click",
          metadata: ads.meta || ads.tiktok ? { fbclid: `fb-${label}`, ttclid: `tt-${label}` } : {},
        },
      });
      const token = createPostbackToken(user.id);
      if (!token) throw new Error("token de postback nulo");
      return { user, presell, click, token };
    }

    const a = await makeAccount("a", { google: true });
    const b = await makeAccount("b", {});
    const ads = await makeAccount("ads", { meta: true, tiktok: true });

    const sale = await post(a.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: `${run}-S1`,
      order_id: `${run}-ORD1`,
      payment_id: `${run}-PAY1`,
      amount_affiliate: "21.85",
      currency: "EUR",
    });
    const saleRow = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-S1` } },
    });
    const presellAfterSale = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    record(
      "sale",
      "venda atribuída",
      sale.statusCode === 200 &&
        sale.payload.conversion === "created" &&
        sale.payload.attribution === "attributed" &&
        saleRow?.status === "approved" &&
        Number(saleRow.amount) === 21.85 &&
        saleRow.clickId === a.click.id &&
        saleRow.presellId === a.presell.id &&
        saleRow.userId === a.user.id &&
        presellAfterSale?.conversions === 1,
      `http=${sale.statusCode} conversion=${String(sale.payload.conversion)} amount=${saleRow ? Number(saleRow.amount) : "null"} presell=${presellAfterSale?.conversions}`,
    );

    const again = await post(a.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: `${run}-S1`,
      order_id: `${run}-ORD1`,
      payment_id: `${run}-PAY1`,
      amount_affiliate: "21.85",
      currency: "EUR",
    });
    const countAfterDup = await prisma.conversion.count({
      where: { userId: a.user.id, externalOrderId: `${run}-S1` },
    });
    const presellAfterDup = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    record(
      "duplicate",
      "repetição sem segunda venda",
      again.payload.conversion === "duplicate" && countAfterDup === 1 && presellAfterDup?.conversions === 1,
      `conversion=${String(again.payload.conversion)} rows=${countAfterDup} presell=${presellAfterDup?.conversions}`,
    );

    const partial = await post(a.token, {
      platform: "Digistore24",
      transaction_type: "refund",
      transaction_id: `${run}-Rpartial`,
      order_id: `${run}-ORD1`,
      parent_transaction_id: `${run}-S1`,
      payment_id: `${run}-PAY1`,
      amount_affiliate: "5.00",
      currency: "EUR",
    });
    const afterPartial = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-S1` } },
    });
    const presellAfterPartial = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    record(
      "partial",
      "reembolso parcial mantém o resto",
      partial.payload.conversion === "restated" &&
        afterPartial?.status === "approved" &&
        Math.abs(Number(afterPartial.amount) - 16.85) < 0.001 &&
        presellAfterPartial?.conversions === 1,
      `conversion=${String(partial.payload.conversion)} status=${afterPartial?.status} amount=${afterPartial ? Number(afterPartial.amount) : "null"} presell=${presellAfterPartial?.conversions}`,
    );

    const full = await post(a.token, {
      platform: "Digistore24",
      transaction_type: "refund",
      transaction_id: `${run}-Rfull`,
      order_id: `${run}-ORD1`,
      parent_transaction_id: `${run}-S1`,
      payment_id: `${run}-PAY1`,
      amount_affiliate: "16.85",
      currency: "EUR",
    });
    const afterFull = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-S1` } },
    });
    const presellAfterFull = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    await waitFor(async () => {
      const row = await prisma.conversion.findUnique({ where: { id: afterFull!.id } });
      const detail = (row?.googleAdsSyncDetail || {}) as Record<string, unknown>;
      return detail.retraction === "skipped_never_uploaded" || row?.googleAdsSync === "retracted";
    }, "google retraction guard").catch(() => undefined);
    const googleRow = await prisma.conversion.findUnique({ where: { id: afterFull!.id } });
    const googleDetail = (googleRow?.googleAdsSyncDetail || {}) as Record<string, unknown>;
    record(
      "full",
      "reembolso total",
      full.payload.conversion === "refunded" &&
        afterFull?.status === "refunded" &&
        presellAfterFull?.conversions === 0,
      `conversion=${String(full.payload.conversion)} status=${afterFull?.status} presell=${presellAfterFull?.conversions}`,
    );
    record(
      "google",
      "Google Ads não foi contactado",
      googleRow?.googleAdsSync !== "retracted" && googleDetail.retraction !== "sent",
      `googleAdsSync=${googleRow?.googleAdsSync ?? "null"} retraction=${String(googleDetail.retraction ?? "ausente")}`,
    );

    const fullAgain = await post(a.token, {
      platform: "Digistore24",
      transaction_type: "refund",
      transaction_id: `${run}-Rfull`,
      order_id: `${run}-ORD1`,
      parent_transaction_id: `${run}-S1`,
      payment_id: `${run}-PAY1`,
      amount_affiliate: "16.85",
    });
    const presellAfterSecond = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    record(
      "full-repeat",
      "reembolso total repetido",
      fullAgain.payload.conversion === "already_refunded" && presellAfterSecond?.conversions === 0,
      `conversion=${String(fullAgain.payload.conversion)} presell=${presellAfterSecond?.conversions}`,
    );

    await post(a.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: `${run}-T1`,
      order_id: `${run}-ORD2`,
      payment_id: `${run}-PAY-A`,
      pay_sequence_no: "1",
      amount_affiliate: "10.00",
    });
    await post(a.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: `${run}-T2`,
      order_id: `${run}-ORD2`,
      payment_id: `${run}-PAY-B`,
      pay_sequence_no: "2",
      amount_affiliate: "20.00",
    });
    const linked = await post(a.token, {
      platform: "Digistore24",
      transaction_type: "refund",
      transaction_id: `${run}-T9`,
      order_id: `${run}-ORD2`,
      parent_transaction_id: `${run}-T1`,
      payment_id: `${run}-PAY-A`,
      pay_sequence_no: "1",
      amount_affiliate: "10.00",
    });
    const t1 = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-T1` } },
    });
    const t2 = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-T2` } },
    });
    record(
      "digistore-link",
      "reembolso Digistore24 liga à transacção original",
      linked.payload.conversion === "refunded" &&
        t1?.status === "refunded" &&
        t2?.status === "approved" &&
        Number(t2?.amount) === 20,
      `conversion=${String(linked.payload.conversion)} T1=${t1?.status}/${t1 ? Number(t1.amount) : "null"} T2=${t2?.status}/${t2 ? Number(t2.amount) : "null"}`,
    );

    await post(a.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "paying",
      transaction_type: "payment",
      transaction_id: `${run}-U1`,
      order_id: `${run}-ORD3`,
      amount_affiliate: "8.00",
    });
    await post(a.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "paying",
      transaction_type: "payment",
      transaction_id: `${run}-U2`,
      order_id: `${run}-ORD3`,
      amount_affiliate: "9.00",
    });
    const ambiguous = await post(a.token, {
      platform: "Digistore24",
      transaction_type: "refund",
      transaction_id: `${run}-U9`,
      order_id: `${run}-ORD3`,
      amount_affiliate: "8.00",
    });
    const u1 = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-U1` } },
    });
    const u2 = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-U2` } },
    });
    record(
      "digistore-ambiguous",
      "sem id da transacção original não escolhe a venda mais recente",
      ambiguous.payload.conversion === "refund_ambiguous" &&
        u1?.status === "approved" &&
        Number(u1.amount) === 8 &&
        u2?.status === "approved" &&
        Number(u2.amount) === 9,
      `conversion=${String(ambiguous.payload.conversion)} U1=${u1?.status}/${u1 ? Number(u1.amount) : "null"} U2=${u2?.status}/${u2 ? Number(u2.amount) : "null"}`,
    );

    const aBeforeCross = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    const cross = await post(b.token, {
      platform: "Digistore24",
      cid: a.click.id,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: `${run}-XB`,
      order_id: `${run}-ORD-B`,
      amount_affiliate: "4.00",
    });
    const crossRow = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: b.user.id, externalOrderId: `${run}-XB` } },
    });
    const aPresell = await prisma.presellPage.findUnique({ where: { id: a.presell.id } });
    const bPresell = await prisma.presellPage.findUnique({ where: { id: b.presell.id } });
    const stolen = await prisma.conversion.findFirst({
      where: { userId: a.user.id, externalOrderId: `${run}-XB` },
    });
    record(
      "isolation",
      "clique de outra conta não atribui nem mistura a venda",
      cross.payload.conversion === "created_unattributed" &&
        crossRow?.userId === b.user.id &&
        crossRow.presellId == null &&
        crossRow.attribution === "unattributed" &&
        stolen == null &&
        bPresell?.conversions === 0 &&
        aPresell?.conversions === aBeforeCross?.conversions,
      `conversion=${String(cross.payload.conversion)} attribution=${crossRow?.attribution} presellB=${bPresell?.conversions} presellA=${aPresell?.conversions}`,
    );

    const foreignRefund = await post(b.token, {
      platform: "Digistore24",
      transaction_type: "refund",
      transaction_id: `${run}-T2`,
      order_id: `${run}-ORD2`,
      amount_affiliate: "20.00",
    });
    const t2After = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-T2` } },
    });
    record(
      "isolation-refund",
      "reembolso da conta B não altera a venda da conta A",
      foreignRefund.payload.conversion === "refund_not_found" && t2After?.status === "approved" && Number(t2After.amount) === 20,
      `conversion=${String(foreignRefund.payload.conversion)} T2=${t2After?.status}/${t2After ? Number(t2After.amount) : "null"}`,
    );

    await prisma.user.update({
      where: { id: a.user.id },
      data: { jvzooIpnSecret: "jvzoo-staging-secret" },
    });
    const jvFields = {
      ctransaction: "SALE",
      ctransreceipt: `${run}-JVOK`,
      caffitid_amount: "11.00",
      tid: a.click.id,
    };
    const jvOk = await post(a.token, { platform: "JVZoo" }, {
      ...jvFields,
      cverify: jvzooExpectedCverify(jvFields, "jvzoo-staging-secret"),
    });
    const jvOkRow = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-JVOK` } },
    });
    record(
      "jvzoo-ok",
      "cverify válido cria a venda com a comissão",
      jvOk.payload.conversion === "created" && jvOkRow?.status === "approved" && Number(jvOkRow.amount) === 11,
      `conversion=${String(jvOk.payload.conversion)} amount=${jvOkRow ? Number(jvOkRow.amount) : "null"}`,
    );

    const jvBad = await post(
      a.token,
      { platform: "JVZoo" },
      {
        ctransaction: "SALE",
        ctransreceipt: `${run}-JVBAD`,
        caffitid_amount: "11.00",
        tid: a.click.id,
        cverify: "DEADBEEF",
      },
    );
    const jvBadRow = await prisma.conversion.findFirst({
      where: { userId: a.user.id, externalOrderId: `${run}-JVBAD` },
    });
    record(
      "jvzoo-bad",
      "cverify inválido não cria venda",
      jvBad.payload.conversion === "ignored" && jvBadRow == null,
      `conversion=${String(jvBad.payload.conversion)} reason=${String(jvBad.payload.reason ?? "")} row=${jvBadRow ? "existe" : "ausente"}`,
    );

    const cbPlain = JSON.stringify({
      transactionType: "SALE",
      receipt: `${run}-CB1`,
      totalAccountAmount: "15.00",
      tid: a.click.id,
      customer: { email: "buyer@example.com" },
    });
    const cbMissing = await post(b.token, {}, clickbankEnvelope(cbPlain, "CBSECRET1"));
    const cbMissingRow = await prisma.conversion.findFirst({
      where: { userId: b.user.id, externalOrderId: `${run}-CB1` },
    });
    record(
      "clickbank-missing",
      "INS cifrado sem segredo na conta é ignorado",
      cbMissing.payload.conversion === "ignored" && cbMissing.payload.reason === "clickbank_secret_missing" && cbMissingRow == null,
      `conversion=${String(cbMissing.payload.conversion)} reason=${String(cbMissing.payload.reason ?? "")}`,
    );

    await prisma.user.update({
      where: { id: a.user.id },
      data: { clickbankInsSecret: "CBSECRET1" },
    });
    const cbBad = await post(a.token, {}, clickbankEnvelope(cbPlain, "OUTRA"));
    const cbBadRow = await prisma.conversion.findFirst({
      where: { userId: a.user.id, externalOrderId: `${run}-CB1` },
    });
    record(
      "clickbank-bad",
      "INS com segredo errado não cria venda",
      cbBad.payload.conversion === "ignored" && cbBad.payload.reason === "clickbank_decrypt_failed" && cbBadRow == null,
      `conversion=${String(cbBad.payload.conversion)} reason=${String(cbBad.payload.reason ?? "")}`,
    );

    const cbOk = await post(a.token, {}, clickbankEnvelope(cbPlain, "CBSECRET1"));
    const cbOkRow = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-CB1` } },
    });
    const cbLog = await prisma.postbackLog.findFirst({
      where: { userId: a.user.id, platform: "clickbank" },
      orderBy: { createdAt: "desc" },
    });
    const cbLogged = JSON.stringify(cbLog?.payload ?? {});
    record(
      "clickbank-ok",
      "INS decifrado cria a venda sem gravar o e-mail do comprador",
      cbOk.payload.conversion === "created" &&
        cbOkRow?.status === "approved" &&
        Number(cbOkRow.amount) === 15 &&
        cbOkRow.clickId === a.click.id &&
        !cbLogged.includes("buyer@example.com"),
      `conversion=${String(cbOk.payload.conversion)} amount=${cbOkRow ? Number(cbOkRow.amount) : "null"} click=${cbOkRow?.clickId === a.click.id}`,
    );

    const secretReq = { user: { userId: a.user.id }, body: { jvzoo_ipn_secret: "jvzoo-from-api", clickbank_ins_secret: "CBAPIKEY1" } } as unknown as Request;
    let secretBody: Record<string, unknown> = {};
    const secretRes = {
      status() { return this; },
      json(data: Record<string, unknown>) { secretBody = data; return this; },
    } as unknown as Response;
    await runWithTenantContext({ tenantId: a.user.id }, () =>
      integrationsController.patchAffiliateSecrets(secretReq, secretRes),
    );
    const secretDump = JSON.stringify(secretBody);
    record(
      "secrets-api",
      "a API guarda os segredos e não os devolve",
      secretBody.ok === true &&
        secretBody.has_jvzoo_ipn_secret === true &&
        secretBody.has_clickbank_ins_secret === true &&
        !secretDump.includes("jvzoo-from-api") &&
        !secretDump.includes("CBAPIKEY1"),
      `body=${secretDump}`,
    );
    const jvApiFields = {
      ctransaction: "SALE",
      ctransreceipt: `${run}-JVAPI`,
      caffitid_amount: "7.00",
      tid: a.click.id,
    };
    const jvApi = await post(a.token, { platform: "JVZoo" }, {
      ...jvApiFields,
      cverify: jvzooExpectedCverify(jvApiFields, "jvzoo-from-api"),
    });
    const jvApiRow = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: a.user.id, externalOrderId: `${run}-JVAPI` } },
    });
    record(
      "secrets-api-use",
      "o segredo gravado pela API valida o IPN seguinte",
      jvApi.payload.conversion === "created" && jvApiRow?.status === "approved" && Number(jvApiRow.amount) === 7,
      `conversion=${String(jvApi.payload.conversion)} amount=${jvApiRow ? Number(jvApiRow.amount) : "null"}`,
    );

    const adsSale = await post(ads.token, {
      platform: "BuyGoods",
      subid: ads.click.id,
      orderid: `${run}-AD1`,
      amount: "12.00",
      cy: "USD",
    });
    const adsRow = await prisma.conversion.findUnique({
      where: { userId_externalOrderId: { userId: ads.user.id, externalOrderId: `${run}-AD1` } },
    });
    await waitFor(async () => {
      const row = await prisma.conversion.findUnique({ where: { id: adsRow!.id } });
      return row?.metaCapiSync === "sent" && row?.tiktokEventsSync === "sent";
    }, "mocks purchase").catch(() => undefined);
    const metaPurchase = hits.filter((h) => h.event === "Purchase" && h.path.includes("/events"));
    const tiktokPurchase = hits.filter((h) => h.event === "Purchase" && h.path.includes("/tiktok"));
    const adsAfterSync = adsRow
      ? await prisma.conversion.findUnique({ where: { id: adsRow.id } })
      : null;
    record(
      "ads-sale",
      "venda BuyGoods atribuída",
      adsSale.payload.conversion === "created" && adsAfterSync?.status === "approved" && Number(adsAfterSync.amount) === 12,
      `conversion=${String(adsSale.payload.conversion)} amount=${adsAfterSync ? Number(adsAfterSync.amount) : "null"}`,
    );
    record(
      "meta-mock",
      "Meta CAPI simulada (mock local, não o Graph)",
      metaPurchase.length === 1 && metaPurchase[0].value === 12 && adsAfterSync?.metaCapiSync === "sent",
      `hits=${metaPurchase.length} value=${metaPurchase[0]?.value ?? "null"} sync=${adsAfterSync?.metaCapiSync ?? "null"}`,
    );
    record(
      "tiktok-mock",
      "TikTok Events simulado (mock local, não a API TikTok)",
      tiktokPurchase.length === 1 && tiktokPurchase[0].value === 12 && adsAfterSync?.tiktokEventsSync === "sent",
      `hits=${tiktokPurchase.length} value=${tiktokPurchase[0]?.value ?? "null"} sync=${adsAfterSync?.tiktokEventsSync ?? "null"}`,
    );

    if (!adsRow) {
      record(
        "ads-partial",
        "reembolso parcial de 4 mantém a venda e avisa Meta e TikTok só desse valor",
        false,
        "venda de anúncios ausente",
      );
    } else {
      const adsPartial = await post(ads.token, {
        platform: "BuyGoods",
        status: "refund",
        orderid: `${run}-AD1`,
        amount: "4.00",
      });
      await waitFor(async () => {
        const row = await prisma.conversion.findUnique({ where: { id: adsRow.id } });
        const meta = (row?.metaCapiSyncDetail || {}) as Record<string, unknown>;
        const tiktok = (row?.tiktokEventsSyncDetail || {}) as Record<string, unknown>;
        return meta.partial_refund === "sent" && tiktok.partial_refund === "sent";
      }, "reembolso parcial").catch(() => undefined);
      const afterPartial = await prisma.conversion.findUnique({ where: { id: adsRow.id } });
      const metaDetail = (afterPartial?.metaCapiSyncDetail || {}) as Record<string, unknown>;
      const tiktokDetail = (afterPartial?.tiktokEventsSyncDetail || {}) as Record<string, unknown>;
      const metaRefund = hits.filter((h) => h.event === "Refund" && h.path.includes("/events"));
      const tiktokRefund = hits.filter((h) => h.event === "Refund" && h.path.includes("/tiktok"));
      record(
        "ads-partial",
        "reembolso parcial de 4 mantém a venda e avisa Meta e TikTok só desse valor",
        adsPartial.payload.conversion === "restated" &&
          afterPartial?.status === "approved" &&
          Number(afterPartial.amount) === 8 &&
          afterPartial.metaCapiSync === "sent" &&
          afterPartial.tiktokEventsSync === "sent" &&
          metaDetail.partial_refund === "sent" &&
          tiktokDetail.partial_refund === "sent" &&
          metaRefund.length === 1 &&
          metaRefund[0]?.value === 4 &&
          tiktokRefund.length === 1 &&
          tiktokRefund[0]?.value === 4,
        `conversion=${String(adsPartial.payload.conversion)} amount=${afterPartial ? Number(afterPartial.amount) : "null"} meta=${String(metaDetail.partial_refund ?? "ausente")} tiktok=${String(tiktokDetail.partial_refund ?? "ausente")} metaHits=${metaRefund.length} tiktokHits=${tiktokRefund.length}`,
      );
    }

    if (adsRow) {
      await prisma.trackingEvent.update({
        where: { id: ads.click.id },
        data: { metadata: { ttclid: "tt-ads" } },
      });
      await prisma.conversion.update({
        where: { id: adsRow.id },
        data: { status: "refunded" },
      });
      await retractConversionFromMetaCapi(adsRow.id);
      const protectedRow = await prisma.conversion.findUnique({ where: { id: adsRow.id } });
      const detail = (protectedRow?.metaCapiSyncDetail || {}) as Record<string, unknown>;
      record(
        "meta-protect",
        "reembolso sem fbclid não apaga o estado sent da Meta",
        protectedRow?.metaCapiSync === "sent" && detail.refund !== undefined && protectedRow.metaCapiSync !== "skipped_no_fbclid",
        `sync=${protectedRow?.metaCapiSync ?? "null"} refund=${String(detail.refund ?? "ausente")}`,
      );
    }

    const failed = results.filter((r) => !r.pass);
    console.log(`SUMMARY pass=${results.length - failed.length} fail=${failed.length} total=${results.length}`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

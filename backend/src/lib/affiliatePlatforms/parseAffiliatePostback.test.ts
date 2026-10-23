import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  classifyRefundAdjustment,
  jvzooCverifyMatches,
  jvzooExpectedCverify,
  metadataWithRefundTxn,
  parseAffiliatePostback,
  redactAffiliateFlat,
  refundTransactionIds,
} from "./parseAffiliatePostback";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("Digistore: comissão, não o bruto, e payment_missed não reembolsa", () => {
  const sale = parseAffiliatePostback({
    platform: "Digistore24",
    flat: {
      cid: UUID,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: "T1",
      order_id: "ORD",
      amount: "97.00",
      amount_affiliate: "21.85",
      amount_brutto: "97.00",
      currency: "EUR",
    },
  });
  assert.equal(sale.adapterId, "digistore24");
  assert.equal(sale.outcome.kind, "approved");
  assert.equal(sale.clickId, UUID);
  assert.equal(sale.externalId, "T1");
  assert.equal(sale.networkOrderId, "ORD");
  assert.equal(Number(sale.amount), 21.85);

  const missed = parseAffiliatePostback({
    platform: "Digistore24",
    flat: { transaction_type: "payment_missed", billing_status: "paying", order_id: "ORD", transaction_id: "T2" },
  });
  assert.equal(missed.outcome.kind, "ignore");

  const refund = parseAffiliatePostback({
    platform: "Digistore24",
    flat: { transaction_type: "refund", billing_status: "completed", order_id: "ORD", transaction_id: "T9", amount_affiliate: "21.85" },
  });
  assert.equal(refund.outcome.kind, "refund");
  assert.equal(refund.networkOrderId, "ORD");
  assert.equal(refund.externalId, "T9");
});

test("Digistore não lê subid de outra rede como clique", () => {
  const parsed = parseAffiliatePostback({
    platform: "Digistore24",
    flat: { subid: UUID, billing_status: "completed", transaction_type: "payment", amount_affiliate: "5" },
  });
  assert.equal(parsed.clickId, null);
});

test("BuyGoods: venda sem status fixo; checkout não é venda; não lê cid", () => {
  const sale = parseAffiliatePostback({
    platform: "BuyGoods",
    flat: { subid: UUID, orderid: "BG1", amount: "12.00", product: "nutra" },
  });
  assert.equal(sale.adapterId, "buygoods");
  assert.equal(sale.outcome.kind, "approved");
  assert.equal(Number(sale.amount), 12);

  const checkout = parseAffiliatePostback({
    platform: "BuyGoods",
    flat: { subid: UUID, funnel_step: "checkout" },
  });
  assert.equal(checkout.outcome.kind, "funnel");

  const foreign = parseAffiliatePostback({
    platform: "BuyGoods",
    flat: { cid: UUID, orderid: "BG2", amount: "9" },
  });
  assert.equal(foreign.clickId, null);
});

test("MaxWeb isolado de Digistore e checkout não aprova", () => {
  const parsed = parseAffiliatePostback({
    platform: "MaxWeb",
    flat: { subid: UUID, orderid: "MW1", COMMISSION_AMOUNT: "8", billing_status: "completed", amount_affiliate: "99" },
  });
  assert.equal(parsed.adapterId, "maxweb");
  assert.equal(parsed.outcome.kind, "approved");
  assert.equal(Number(parsed.amount), 8);

  const visit = parseAffiliatePostback({
    platform: "MaxWeb",
    flat: { subid: UUID, funnel_step: "checkout", orderid: "MW1", amount: "8" },
  });
  assert.equal(visit.outcome.kind, "funnel");
});

test("MaxWeb: subid=path id (3986) não-UUID; atribui via subid2", () => {
  const parsed = parseAffiliatePostback({
    platform: "MaxWeb",
    flat: {
      subid: "3986",
      SUBID: "3986",
      subid2: UUID,
      SUBID2: UUID,
      orderid: "MW-PATH",
      COMMISSION_AMOUNT: "12.50",
    },
  });
  assert.equal(parsed.adapterId, "maxweb");
  assert.equal(parsed.outcome.kind, "approved");
  assert.equal(parsed.clickId, UUID);
  assert.equal(Number(parsed.amount), 12.5);
});

test("SmartAdv: approved ganha a checkout no mesmo payload; rejected não é venda", () => {
  const sale = parseAffiliatePostback({
    platform: "SmartAdv",
    flat: { sub3: UUID, transaction_id: "S1", payout: "4.5", status: "approved", event: "checkout" },
  });
  assert.equal(sale.outcome.kind, "approved");
  assert.equal(Number(sale.amount), 4.5);

  const rejected = parseAffiliatePostback({
    platform: "SmartAdv",
    flat: { sub3: UUID, transaction_id: "S2", status: "rejected", payout: "4" },
  });
  assert.equal(rejected.outcome.kind, "ignore");
});

test("Hotmart afiliado: aprovado e reembolso; preço do comprador não é comissão", () => {
  const body = {
    event: "PURCHASE_APPROVED",
    data: {
      purchase: { transaction: "HP1", status: "APPROVED", price: { value: 197 }, origin: { src: UUID } },
      commissions: [{ source: "AFFILIATE", value: 40, currency_value: "BRL" }],
    },
  };
  const sale = parseAffiliatePostback({ platform: "Hotmart", flat: { platform: "Hotmart" }, body });
  assert.equal(sale.outcome.kind, "approved");
  assert.equal(sale.clickId, UUID);
  assert.equal(sale.externalId, "HP1");
  assert.equal(Number(sale.amount), 40);
  assert.equal(sale.currency, "BRL");

  const refund = parseAffiliatePostback({
    platform: "Hotmart",
    flat: {},
    body: { event: "PURCHASE_REFUNDED", data: { purchase: { transaction: "HP1", status: "REFUNDED" } } },
  });
  assert.equal(refund.outcome.kind, "refund");

  const boleto = parseAffiliatePostback({
    platform: "Hotmart",
    flat: {},
    body: { event: "PURCHASE_BILLET_PRINTED", data: { purchase: { transaction: "HP2", status: "PRINTED_BILLET" } } },
  });
  assert.equal(boleto.outcome.kind, "pending");
});

test("ClickBank em claro e envelope cifrado", () => {
  const sale = parseAffiliatePostback({
    platform: "ClickBank",
    flat: { transactionType: "SALE", receipt: "R1", totalAccountAmount: "15.00", tid: UUID },
  });
  assert.equal(sale.outcome.kind, "approved");
  assert.equal(sale.clickId, UUID);
  assert.equal(Number(sale.amount), 15);

  const refund = parseAffiliatePostback({
    platform: "ClickBank",
    flat: { transactionType: "RFND", receipt: "R1" },
  });
  assert.equal(refund.outcome.kind, "refund");

  const encrypted = parseAffiliatePostback({
    platform: "ClickBank",
    flat: {},
    body: { notification: "cipher", iv: "iv" },
  });
  assert.equal(encrypted.outcome.kind, "ignore");
  if (encrypted.outcome.kind === "ignore") assert.equal(encrypted.outcome.reason, "clickbank_encrypted");
});

test("WarriorPlus e JVZoo não usam status=approved genérico", () => {
  const wp = parseAffiliatePostback({
    platform: "WarriorPlus",
    flat: { WP_ACTION: "refund", WP_SALEID: "sale_1", WP_SALE_AMOUNT: "97", WP_COMMISSION: "20", WP_TID: UUID },
  });
  assert.equal(wp.outcome.kind, "refund");
  assert.equal(Number(wp.amount), 20);

  const jv = parseAffiliatePostback({
    platform: "JVZoo",
    flat: { ctransaction: "CANCEL-REBILL", ctransreceipt: "J1", ctransamount: "10", tid: UUID },
  });
  assert.equal(jv.outcome.kind, "ignore");

  const jvSale = parseAffiliatePostback({
    platform: "JVZoo",
    flat: { ctransaction: "SALE", ctransreceipt: "J2", ctransamount: "10", tid: UUID },
  });
  assert.equal(jvSale.outcome.kind, "approved");
  assert.equal(jvSale.externalId, "J2");
});

test("contrato genérico exige status e não trata paying nem cid", () => {
  const vague = parseAffiliatePostback({
    platform: "AdCombo",
    flat: { cid: UUID, status: "paying", amount: "5", billing_status: "completed" },
  });
  assert.equal(vague.outcome.kind, "ignore");
  assert.equal(vague.clickId, null);

  const ok = parseAffiliatePostback({
    platform: "AdCombo",
    flat: { clickora_click_id: UUID, status: "approved", amount: "5", orderid: "A1" },
  });
  assert.equal(ok.outcome.kind, "approved");
  assert.equal(ok.clickId, UUID);
});

test("sem platform, billing_status escolhe Digistore e não o genérico", () => {
  const parsed = parseAffiliatePostback({
    flat: { cid: UUID, billing_status: "completed", transaction_type: "payment", amount_affiliate: "3", transaction_id: "T" },
  });
  assert.equal(parsed.adapterId, "digistore24");
  assert.ok(parsed.amount instanceof Prisma.Decimal);
});

test("reembolso menor que a venda fica parcial; chargeback e valor igual ficam totais", () => {
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 21.85, refundAmount: 5 }),
    "partial",
  );
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 21.85, refundAmount: 21.85 }),
    "full",
  );
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 21.85, refundAmount: null }),
    "full",
  );
  assert.equal(
    classifyRefundAdjustment({ kind: "chargeback", existingAmount: 21.85, refundAmount: 5 }),
    "full",
  );
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 12, refundAmount: 0 }),
    "full",
  );
});

test("id de reembolso repetido fica registado uma vez", () => {
  const once = metadataWithRefundTxn({ network_order_id: "ORD" }, { refund_kind: "refund" }, "T9");
  const twice = metadataWithRefundTxn(once, { refund_kind: "refund" }, "T9");
  const next = metadataWithRefundTxn(twice, { refund_kind: "refund" }, "T10");
  assert.deepEqual(refundTransactionIds(once), ["T9"]);
  assert.deepEqual(refundTransactionIds(twice), ["T9"]);
  assert.deepEqual(refundTransactionIds(next), ["T9", "T10"]);
  assert.equal(next.network_order_id, "ORD");
});

test("matriz de payloads: venda, repetição, checkout, reembolso parcial e total", () => {
  const sale = (platform: string, flat: Record<string, string>, body?: unknown) =>
    parseAffiliatePostback({ platform, flat, body });

  const digistoreSale = sale("Digistore24", {
    cid: UUID,
    billing_status: "completed",
    transaction_type: "payment",
    transaction_id: "T1",
    order_id: "ORD",
    amount_affiliate: "21.85",
  });
  const digistoreAgain = sale("Digistore24", {
    cid: UUID,
    billing_status: "completed",
    transaction_type: "payment",
    transaction_id: "T1",
    order_id: "ORD",
    amount_affiliate: "21.85",
  });
  assert.equal(digistoreSale.outcome.kind, "approved");
  assert.equal(digistoreAgain.externalId, digistoreSale.externalId);
  const digistorePartial = sale("Digistore24", {
    transaction_type: "refund",
    transaction_id: "T9",
    order_id: "ORD",
    amount_affiliate: "5.00",
  });
  assert.equal(digistorePartial.outcome.kind, "refund");
  assert.equal(digistorePartial.externalId, "T9");
  assert.equal(digistorePartial.networkOrderId, "ORD");
  if (digistorePartial.outcome.kind === "refund") assert.equal(digistorePartial.outcome.partial, false);
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: Number(digistoreSale.amount),
      refundAmount: Number(digistorePartial.amount),
    }),
    "partial",
  );
  const digistoreFull = sale("Digistore24", {
    transaction_type: "refund",
    transaction_id: "T10",
    order_id: "ORD",
    amount_affiliate: "21.85",
  });
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: Number(digistoreSale.amount),
      refundAmount: Number(digistoreFull.amount),
    }),
    "full",
  );
  assert.equal(
    sale("Digistore24", { transaction_type: "chargeback", transaction_id: "T11", order_id: "ORD", amount_affiliate: "21.85" }).outcome.kind,
    "chargeback",
  );

  const buyCheckout = sale("BuyGoods", { subid: UUID, funnel_step: "checkout" });
  assert.equal(buyCheckout.outcome.kind, "funnel");
  const buySale = sale("BuyGoods", { subid: UUID, orderid: "BG1", COMMISSION_AMOUNT: "12.00" });
  const buyAgain = sale("BuyGoods", { subid: UUID, orderid: "BG1", COMMISSION_AMOUNT: "12.00" });
  assert.equal(buySale.outcome.kind, "approved");
  assert.equal(buyAgain.externalId, "BG1");
  const buyPartial = sale("BuyGoods", { orderid: "BG1", status: "refund", COMMISSION_AMOUNT: "4" });
  assert.equal(buyPartial.outcome.kind, "refund");
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 12, refundAmount: Number(buyPartial.amount) }),
    "partial",
  );
  const buyFull = sale("BuyGoods", { orderid: "BG1", status: "refund", COMMISSION_AMOUNT: "12" });
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 12, refundAmount: Number(buyFull.amount) }),
    "full",
  );

  const maxCheckout = sale("MaxWeb", { subid: UUID, funnel_step: "checkout" });
  assert.equal(maxCheckout.outcome.kind, "funnel");
  const maxSale = sale("MaxWeb", { subid: UUID, ORDERID: "MW1", COMMISSION_AMOUNT: "8" });
  assert.equal(maxSale.outcome.kind, "approved");
  assert.equal(sale("MaxWeb", { ORDERID: "MW1", status: "refund", COMMISSION_AMOUNT: "8" }).outcome.kind, "refund");
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: 8,
      refundAmount: Number(sale("MaxWeb", { ORDERID: "MW1", status: "refund", COMMISSION_AMOUNT: "3" }).amount),
    }),
    "partial",
  );

  const smartCheckout = sale("SmartAdv", { sub3: UUID, event: "checkout", transaction_id: "S0" });
  assert.equal(smartCheckout.outcome.kind, "funnel");
  const smartSale = sale("SmartAdv", { sub3: UUID, transaction_id: "S1", payout: "4.5", status: "approved" });
  assert.equal(smartSale.outcome.kind, "approved");
  assert.equal(sale("SmartAdv", { transaction_id: "S1", payout: "4.5", status: "approved" }).externalId, "S1");
  assert.equal(sale("SmartAdv", { transaction_id: "S1", status: "refund", payout: "4.5" }).outcome.kind, "refund");
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: 4.5,
      refundAmount: Number(sale("SmartAdv", { transaction_id: "S9", status: "refund", payout: "1.5" }).amount),
    }),
    "partial",
  );

  const hotSale = sale("Hotmart", {}, {
    event: "PURCHASE_APPROVED",
    data: {
      purchase: { transaction: "HP1", status: "APPROVED", price: { value: 197 }, origin: { src: UUID } },
      commissions: [{ source: "AFFILIATE", value: 40, currency_value: "BRL" }],
    },
  });
  assert.equal(hotSale.outcome.kind, "approved");
  assert.equal(Number(hotSale.amount), 40);
  const hotPartial = sale("Hotmart", {}, {
    event: "PURCHASE_REFUNDED",
    data: {
      purchase: { transaction: "HP1", status: "PARTIALLY_REFUNDED" },
      commissions: [{ source: "AFFILIATE", value: 10, currency_value: "BRL" }],
    },
  });
  assert.equal(hotPartial.outcome.kind, "refund");
  if (hotPartial.outcome.kind === "refund") assert.equal(hotPartial.outcome.partial, true);
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 40, refundAmount: Number(hotPartial.amount) }),
    "partial",
  );
  const hotFull = sale("Hotmart", {}, {
    event: "PURCHASE_REFUNDED",
    data: { purchase: { transaction: "HP1", status: "REFUNDED" }, commissions: [{ source: "AFFILIATE", value: 40 }] },
  });
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 40, refundAmount: Number(hotFull.amount) }),
    "full",
  );
  assert.equal(
    sale("Hotmart", {}, { event: "PURCHASE_CHARGEBACK", data: { purchase: { transaction: "HP1", status: "CHARGEBACK" } } }).outcome.kind,
    "chargeback",
  );

  const cbSale = sale("ClickBank", { transactionType: "SALE", receipt: "R1", totalAccountAmount: "15.00", tid: UUID });
  assert.equal(cbSale.outcome.kind, "approved");
  assert.equal(sale("ClickBank", { transactionType: "SALE", receipt: "R1", totalAccountAmount: "15.00", tid: UUID }).externalId, "R1");
  assert.equal(sale("ClickBank", { transactionType: "ABANDONED_ORDER", receipt: "R1" }).outcome.kind, "ignore");
  const cbPartial = sale("ClickBank", { transactionType: "RFND", receipt: "R1", totalAccountAmount: "5" });
  assert.equal(cbPartial.outcome.kind, "refund");
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 15, refundAmount: Number(cbPartial.amount) }),
    "partial",
  );
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: 15,
      refundAmount: Number(sale("ClickBank", { transactionType: "RFND", receipt: "R1", totalAccountAmount: "15" }).amount),
    }),
    "full",
  );
  assert.equal(sale("ClickBank", { transactionType: "CGBK", receipt: "R1" }).outcome.kind, "chargeback");
  assert.equal(
    sale("ClickBank", {}, { notification: "cipher", iv: "iv" }).outcome.kind,
    "ignore",
  );

  const wpSale = sale("WarriorPlus", { WP_ACTION: "sale", WP_SALEID: "W1", WP_COMMISSION: "20", WP_SALE_AMOUNT: "97", WP_TID: UUID });
  assert.equal(wpSale.outcome.kind, "approved");
  assert.equal(Number(wpSale.amount), 20);
  assert.equal(sale("WarriorPlus", { WP_ACTION: "sale", WP_SALEID: "W1", WP_COMMISSION: "20" }).externalId, "W1");
  const wpPartial = sale("WarriorPlus", { WP_ACTION: "refund", WP_SALEID: "W1", WP_COMMISSION: "7", WP_SALE_AMOUNT: "97" });
  assert.equal(wpPartial.outcome.kind, "refund");
  assert.equal(Number(wpPartial.amount), 7);
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 20, refundAmount: Number(wpPartial.amount) }),
    "partial",
  );
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: 20,
      refundAmount: Number(sale("WarriorPlus", { WP_ACTION: "refund", WP_SALEID: "W1", WP_COMMISSION: "20" }).amount),
    }),
    "full",
  );
  assert.equal(sale("WarriorPlus", { WP_ACTION: "dispute", WP_SALEID: "W1", WP_COMMISSION: "20" }).outcome.kind, "chargeback");

  const jvSale = sale("JVZoo", { ctransaction: "SALE", ctransreceipt: "J2", caffitid_amount: "11", ctransamount: "97", tid: UUID });
  assert.equal(jvSale.outcome.kind, "approved");
  assert.equal(Number(jvSale.amount), 11);
  assert.equal(sale("JVZoo", { ctransaction: "SALE", ctransreceipt: "J2", caffitid_amount: "11" }).externalId, "J2");
  const jvPartial = sale("JVZoo", { ctransaction: "RFND", ctransreceipt: "J2", caffitid_amount: "4" });
  assert.equal(jvPartial.outcome.kind, "refund");
  assert.equal(
    classifyRefundAdjustment({ kind: "refund", existingAmount: 11, refundAmount: Number(jvPartial.amount) }),
    "partial",
  );
  assert.equal(
    classifyRefundAdjustment({
      kind: "refund",
      existingAmount: 11,
      refundAmount: Number(sale("JVZoo", { ctransaction: "RFND", ctransreceipt: "J2", caffitid_amount: "11" }).amount),
    }),
    "full",
  );
  assert.equal(sale("JVZoo", { ctransaction: "CGBK", ctransreceipt: "J2" }).outcome.kind, "chargeback");
});

test("JVZoo cverify recusa assinatura falsa e aceita a assinatura do segredo", () => {
  const fields = {
    ctransaction: "SALE",
    ctransreceipt: "J2",
    caffitid_amount: "11.00",
    tid: UUID,
  };
  const secret = "jvzoo-staging-secret";
  const good = jvzooExpectedCverify(fields, secret);
  assert.equal(good.length, 8);
  assert.equal(jvzooCverifyMatches({ ...fields, cverify: good }, secret), true);
  assert.equal(jvzooCverifyMatches({ ...fields, cverify: "DEADBEEF" }, secret), false);
  assert.equal(jvzooCverifyMatches({ ...fields, cverify: good, token: "nao-entra" }, secret), false);
});

test("redige token no log", () => {
  const redacted = redactAffiliateFlat({ token: "segredo", orderid: "1", cverify: "ABC" });
  assert.equal(redacted.token, "[redacted]");
  assert.equal(redacted.cverify, "[redacted]");
  assert.equal(redacted.orderid, "1");
});

test("postback já colado nas campanhas continua a contar a venda", () => {
  const digistore = parseAffiliatePostback({
    platform: "Digistore24",
    flat: {
      cid: UUID,
      sid1: UUID,
      clickora_click_id: UUID,
      amount: "21.85",
      billing_status: "completed",
      transaction_type: "payment",
      orderid: "ORD-ANTIGO",
      cy: "EUR",
    },
  });
  assert.equal(digistore.outcome.kind, "approved");
  assert.equal(digistore.clickId, UUID);
  assert.equal(digistore.externalId, "ORD-ANTIGO");
  assert.equal(Number(digistore.amount), 21.85);

  const buygoodsRefund = parseAffiliatePostback({
    platform: "BuyGoods",
    flat: {
      subid: UUID,
      clickora_click_id: UUID,
      orderid: "BG1",
      amount: "12.00",
      status: "approved",
      transaction_type: "refund",
    },
  });
  assert.equal(buygoodsRefund.outcome.kind, "refund");

  const smartadv = parseAffiliatePostback({
    platform: "SmartAdv",
    flat: {
      cid: UUID,
      sub3: UUID,
      clickora_click_id: UUID,
      orderid: "SA1",
      amount: "9.00",
      status: "approved",
      transaction_type: "approved",
    },
  });
  assert.equal(smartadv.outcome.kind, "approved");
  assert.equal(smartadv.clickId, UUID);

  const maxweb = parseAffiliatePostback({
    platform: "MaxWeb",
    flat: { s1: UUID, orderid: "MW1", amount: "8.00", cy: "USD" },
  });
  assert.equal(maxweb.outcome.kind, "approved");
  assert.equal(maxweb.clickId, UUID);

  for (const platform of ["ClickBank", "JVZoo", "WarriorPlus", "Hotmart"]) {
    const legacy = parseAffiliatePostback({
      platform,
      flat: {
        orderid: "LEG-1",
        amount: "15.00",
        cy: "USD",
        status: "approved",
        clickora_click_id: UUID,
        subid1: UUID,
      },
    });
    assert.equal(legacy.outcome.kind, "approved", platform);
    assert.equal(legacy.clickId, UUID, platform);
    assert.equal(legacy.externalId, "LEG-1", platform);
    assert.equal(Number(legacy.amount), 15, platform);
  }

  const encrypted = parseAffiliatePostback({
    platform: "ClickBank",
    flat: { notification: "abc", iv: "def" },
    body: { notification: "abc", iv: "def" },
  });
  assert.equal(encrypted.outcome.kind, "ignore");
  if (encrypted.outcome.kind === "ignore") assert.equal(encrypted.outcome.reason, "clickbank_encrypted");
});

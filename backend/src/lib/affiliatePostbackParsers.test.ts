import assert from "node:assert/strict";
import test from "node:test";
import {
  extractClickIdFromPayload,
  extractSaleStatusFromPayload,
  isApprovedSaleStatus,
  isNegativeSaleEvent,
  mergeJsonBodyIntoFlatRecord,
  pickAmountDecimal,
} from "./affiliatePostbackParsers";

test("merge nested object exposes dotted keys and leaf alias for subid1", () => {
  const out: Record<string, string> = {};
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  mergeJsonBodyIntoFlatRecord({ data: { subid1: uuid, status: "approved" } }, out);
  assert.equal(out["data.subid1"], uuid);
  assert.equal(out["data.status"], "approved");
  assert.equal(out.subid1, uuid);
  assert.equal(out.status, "approved");
});

test("nested click_id maps leaf and extract finds uuid", () => {
  const out: Record<string, string> = {};
  const uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  mergeJsonBodyIntoFlatRecord({ payload: { click_id: uuid } }, out);
  assert.equal(out["payload.click_id"], uuid);
  assert.equal(out.click_id, uuid);
  assert.equal(extractClickIdFromPayload(out), uuid);
});

/** Simula postback Digistore24 S2S (docs oficiais: cid + billing_status + amount_affiliate). */
test("Digistore24 payload: cid UUID + billing_status completed → aprovado", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const flat = {
    cid: uuid,
    billing_status: "completed",
    amount_affiliate: "19.50",
    order_id: "1A2B3C",
    currency: "EUR",
  };
  assert.equal(extractClickIdFromPayload(flat), uuid);
  assert.equal(extractSaleStatusFromPayload(flat), "completed");
  assert.equal(isApprovedSaleStatus(extractSaleStatusFromPayload(flat)), true);
  const amt = pickAmountDecimal(flat);
  assert.ok(amt);
  assert.equal(Number(amt), 19.5);
});

test("Digistore24 paying (rebilling) conta como aprovado", () => {
  assert.equal(isApprovedSaleStatus("paying"), true);
});

test("billing_status aborted NÃO conta como venda", () => {
  assert.equal(isApprovedSaleStatus("aborted"), false);
  assert.equal(isApprovedSaleStatus("unpaid"), false);
});

test("sem click id UUID → atribuição impossível (venda perder-se-ia no Clickora)", () => {
  const flat = { billing_status: "completed", amount_affiliate: "10", cid: "NOT-A-UUID" };
  assert.equal(extractClickIdFromPayload(flat), null);
});

test("Hotmart-style aprovado PT", () => {
  assert.equal(isApprovedSaleStatus("aprovado"), true);
});

test("Digistore refund NÃO conta mesmo com billing_status completed", () => {
  const flat = {
    cid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    billing_status: "completed",
    transaction_type: "refund",
  };
  assert.equal(isApprovedSaleStatus(extractSaleStatusFromPayload(flat)), true);
  assert.equal(isNegativeSaleEvent(flat), true);
});

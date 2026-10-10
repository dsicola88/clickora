import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSubscriptionStatus } from "./subscription";

test("Hotmart PURCHASE_APPROVED activa", () => {
  assert.equal(normalizeSubscriptionStatus("PURCHASE_APPROVED"), "active");
  assert.equal(normalizeSubscriptionStatus("PURCHASE_COMPLETE"), "active");
});

test("Hotmart reembolso, chargeback, cancelamento e expiração não activam", () => {
  assert.equal(normalizeSubscriptionStatus("PURCHASE_REFUNDED"), "canceled");
  assert.equal(normalizeSubscriptionStatus("PURCHASE_CHARGEBACK"), "canceled");
  assert.equal(normalizeSubscriptionStatus("PURCHASE_CANCELED"), "canceled");
  assert.equal(normalizeSubscriptionStatus("SUBSCRIPTION_CANCELLATION"), "canceled");
  assert.equal(normalizeSubscriptionStatus("PURCHASE_EXPIRED"), "expired");
});

test("boleto, atraso, protesto e evento desconhecido não mudam o acesso", () => {
  assert.equal(normalizeSubscriptionStatus("PURCHASE_BILLET_PRINTED"), null);
  assert.equal(normalizeSubscriptionStatus("PURCHASE_DELAYED"), null);
  assert.equal(normalizeSubscriptionStatus("PURCHASE_PROTEST"), null);
  assert.equal(normalizeSubscriptionStatus("SWITCH_PLAN"), null);
});

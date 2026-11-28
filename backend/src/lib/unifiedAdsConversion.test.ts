import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adsExternalOrderId, adsPostbackOrderId } from "./unifiedAdsConversion";

describe("unifiedAdsConversion ledger keys", () => {
  it("external order id namespaced by origin", () => {
    const ga = adsExternalOrderId("google_ads", "ORDER-1");
    const ms = adsExternalOrderId("microsoft_ads", "ORDER-1");
    assert.equal(ga, "google_ads:ORDER-1");
    assert.equal(ms, "microsoft_ads:ORDER-1");
  });

  it("transaction_id explícito é usado tal como vem", () => {
    assert.equal(adsPostbackOrderId("  T-99 ", "gclid-a", "purchase"), "T-99");
  });

  it("sem transaction_id: estável por click ID + conversão (retries não duplicam)", () => {
    const a = adsPostbackOrderId(undefined, "gclid-a", "purchase");
    assert.equal(a, adsPostbackOrderId("", "gclid-a", "purchase"));
    assert.match(a, /^auto-[0-9a-f]{32}$/);
    assert.notEqual(a, adsPostbackOrderId(undefined, "gclid-b", "purchase"));
    assert.notEqual(a, adsPostbackOrderId(undefined, "gclid-a", "lead"));
  });
});

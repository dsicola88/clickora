import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasPaidNetworkClickId, isRealNetworkClickId, resolveTrafficType } from "./networkClickId";

describe("networkClickId", () => {
  it("rejeita macros por substituir", () => {
    assert.equal(isRealNetworkClickId("{gclid}"), false);
    assert.equal(isRealNetworkClickId("{{campaign.name}}"), false);
    assert.equal(isRealNetworkClickId("%7Bgclid%7D"), false);
    assert.equal(isRealNetworkClickId(""), false);
    assert.equal(isRealNetworkClickId(null), false);
  });

  it("aceita IDs reais", () => {
    assert.equal(isRealNetworkClickId("Cj0KCQjw"), true);
    assert.equal(hasPaidNetworkClickId({ gclid: "{gclid}" }), false);
    assert.equal(hasPaidNetworkClickId({ gclid: "EAIaIQobChMI" }), true);
  });

  it("não rotula google_ads/cpc como organic", () => {
    assert.equal(
      resolveTrafficType({ source: "google_ads", medium: "cpc", gclid: "{gclid}" }),
      "paid_untracked",
    );
    assert.equal(
      resolveTrafficType({ source: "google_ads", medium: "cpc", gclid: "EAIaIQobChMI" }),
      "paid",
    );
    assert.equal(resolveTrafficType({ source: "direct", medium: "none" }), "organic");
  });
});

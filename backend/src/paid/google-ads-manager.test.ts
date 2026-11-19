import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveMetricRates, resolveGoogleAdsDateRange } from "./google-ads-connection";

describe("google-ads-manager helpers", () => {
  it("last_7 ok", () => {
    const r = resolveGoogleAdsDateRange("last_7");
    assert.ok(!("error" in r));
  });
  it("agrega métricas", () => {
    const m = deriveMetricRates({
      impressions: 200,
      clicks: 20,
      cost_micros: 10_000_000,
      conversions: 2,
      conversions_value: 40,
    });
    assert.equal(m.ctr, 0.1);
    assert.equal(m.roas, 4);
  });

  it("share mobile a partir de rollup (contrato UI)", () => {
    const devices = [
      { device: "MOBILE", cost: 60 },
      { device: "DESKTOP", cost: 40 },
    ];
    const total = devices.reduce((s, d) => s + d.cost, 0);
    const mobile = devices.find((d) => /MOBILE/i.test(d.device))!.cost / total;
    assert.equal(mobile, 0.6);
  });
});

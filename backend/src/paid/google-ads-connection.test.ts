import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveMetricRates, resolveGoogleAdsDateRange } from "./google-ads-connection";

describe("resolveGoogleAdsDateRange", () => {
  it("aceita last_7 com from ≤ to", () => {
    const r = resolveGoogleAdsDateRange("last_7");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.from <= r.to, true);
    assert.match(r.from, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejeita custom invertido", () => {
    const r = resolveGoogleAdsDateRange("custom", "2026-11-10", "2026-11-01");
    assert.ok("error" in r);
  });

  it("aceita custom válido", () => {
    const r = resolveGoogleAdsDateRange("custom", "2026-11-01", "2026-11-10");
    assert.deepEqual(r, { from: "2026-11-01", to: "2026-11-10" });
  });
});

describe("deriveMetricRates", () => {
  it("calcula CTR, CPC e ROAS sem divisão por zero", () => {
    const z = deriveMetricRates({ impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 });
    assert.equal(z.ctr, 0);
    assert.equal(z.average_cpc_micros, 0);
    assert.equal(z.roas, 0);

    const m = deriveMetricRates({
      impressions: 1000,
      clicks: 50,
      cost_micros: 25_000_000,
      conversions: 5,
      conversions_value: 100,
    });
    assert.equal(m.ctr, 0.05);
    assert.equal(m.average_cpc_micros, 500_000);
    assert.equal(m.cost_per_conversion_micros, 5_000_000);
    assert.equal(m.roas, 4);
  });
});

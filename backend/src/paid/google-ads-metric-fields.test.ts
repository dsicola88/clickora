import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGoogleAdsMetrics } from "./google-ads-metric-fields";

describe("parseGoogleAdsMetrics", () => {
  it("lê costMicros camelCase da REST JSON (não inventa 0 se o campo existir)", () => {
    const m = parseGoogleAdsMetrics({
      metrics: {
        impressions: "345",
        clicks: "48",
        costMicros: "2180000",
        conversions: "0",
        conversionsValue: "0",
      },
    });
    assert.equal(m.clicks, 48);
    assert.equal(m.impressions, 345);
    assert.equal(m.cost_micros, 2_180_000);
  });

  it("aceita snake_case se vier assim", () => {
    const m = parseGoogleAdsMetrics({
      metrics: { cost_micros: 5_000_000, clicks: 2, impressions: 10 },
    });
    assert.equal(m.cost_micros, 5_000_000);
  });

  it("sem metrics → zeros (ausência, não inventário inventado)", () => {
    const m = parseGoogleAdsMetrics({});
    assert.equal(m.cost_micros, 0);
    assert.equal(m.clicks, 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { googleCampaignCreateBiddingOneof, storedGoogleBiddingFromPlanInput } from "./google-campaign-bidding";

describe("storedGoogleBiddingFromPlanInput", () => {
  it("persiste CPA em micros USD", () => {
    const o = storedGoogleBiddingFromPlanInput({
      strategy: "target_cpa",
      google_target_cpa_usd: 12.5,
      google_target_roas: null,
    });
    assert.equal(o.google.strategy, "target_cpa");
    assert.equal(o.google.targetCpaMicros, "12500000");
  });

  it("persiste ROAS alvo", () => {
    const o = storedGoogleBiddingFromPlanInput({
      strategy: "target_roas",
      google_target_cpa_usd: null,
      google_target_roas: 4.25,
    });
    assert.equal(o.google.targetRoas, 4.25);
  });
});

describe("googleCampaignCreateBiddingOneof", () => {
  it("devolve maximizeConversions", () => {
    const b = googleCampaignCreateBiddingOneof({
      google: { strategy: "maximize_conversions" },
    });
    assert.deepEqual(b, { maximizeConversions: {} });
  });

  it("devolve targetCpa com micros", () => {
    const b = googleCampaignCreateBiddingOneof({
      google: { strategy: "target_cpa", targetCpaMicros: "5000000" },
    });
    assert.deepEqual(b, { targetCpa: { targetCpaMicros: "5000000" } });
  });

  it("sem CPA válido faz fallback manual CPC", () => {
    const b = googleCampaignCreateBiddingOneof({
      google: { strategy: "target_cpa" },
    });
    assert.deepEqual(b, { manualCpc: {} });
  });
});

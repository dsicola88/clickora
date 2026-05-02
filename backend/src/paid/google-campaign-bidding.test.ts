import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  googleAdGroupCpcBidMicros,
  googleCampaignCreateBiddingOneof,
  storedGoogleBiddingFromPlanInput,
} from "./google-campaign-bidding";

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

  it("persiste CPC máximo manual em micros USD (1.25 USD → 1_250_000)", () => {
    const o = storedGoogleBiddingFromPlanInput({
      strategy: "manual_cpc",
      google_target_cpa_usd: null,
      google_target_roas: null,
      google_max_cpc_usd: 1.25,
    });
    assert.equal(o.google.strategy, "manual_cpc");
    assert.equal(o.google.manualCpcMicros, "1250000");
  });

  it("ignora CPC máximo quando estratégia ≠ manual_cpc", () => {
    const o = storedGoogleBiddingFromPlanInput({
      strategy: "maximize_conversions",
      google_target_cpa_usd: null,
      google_target_roas: null,
      google_max_cpc_usd: 5,
    });
    assert.equal(o.google.manualCpcMicros, undefined);
  });

  it("ignora CPC máximo zero/negativo/null mesmo em manual_cpc", () => {
    const a = storedGoogleBiddingFromPlanInput({
      strategy: "manual_cpc",
      google_target_cpa_usd: null,
      google_target_roas: null,
      google_max_cpc_usd: 0,
    });
    const b = storedGoogleBiddingFromPlanInput({
      strategy: "manual_cpc",
      google_target_cpa_usd: null,
      google_target_roas: null,
      google_max_cpc_usd: null,
    });
    assert.equal(a.google.manualCpcMicros, undefined);
    assert.equal(b.google.manualCpcMicros, undefined);
  });
});

describe("googleCampaignCreateBiddingOneof", () => {
  it("maximize_clicks devolve targetSpend (ex-maximize clicks na UI)", () => {
    const b = googleCampaignCreateBiddingOneof({
      google: { strategy: "maximize_clicks" },
    });
    assert.deepEqual(b, { targetSpend: {} });
  });

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

  it("manual_cpc no oneof do Campaign continua vazio (CPC vai por AdGroup)", () => {
    const b = googleCampaignCreateBiddingOneof({
      google: { strategy: "manual_cpc", manualCpcMicros: "1500000" },
    });
    assert.deepEqual(b, { manualCpc: {} });
  });
});

describe("googleAdGroupCpcBidMicros", () => {
  it("devolve micros quando estratégia=manual_cpc + valor positivo", () => {
    const v = googleAdGroupCpcBidMicros({
      google: { strategy: "manual_cpc", manualCpcMicros: "1250000" },
    });
    assert.equal(v, "1250000");
  });

  it("devolve null sem manualCpcMicros mesmo em manual_cpc", () => {
    const v = googleAdGroupCpcBidMicros({
      google: { strategy: "manual_cpc" },
    });
    assert.equal(v, null);
  });

  it("devolve null para qualquer estratégia que não manual_cpc", () => {
    const v = googleAdGroupCpcBidMicros({
      google: { strategy: "maximize_conversions", manualCpcMicros: "1250000" },
    });
    assert.equal(v, null);
  });

  it("devolve null para input inválido (string vazia, número, array, etc.)", () => {
    assert.equal(googleAdGroupCpcBidMicros(null), null);
    assert.equal(googleAdGroupCpcBidMicros(undefined), null);
    assert.equal(googleAdGroupCpcBidMicros("nope"), null);
    assert.equal(googleAdGroupCpcBidMicros([1, 2, 3]), null);
    assert.equal(googleAdGroupCpcBidMicros({}), null);
  });
});

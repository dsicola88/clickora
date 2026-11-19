import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeClickCapture } from "./google-ads-click-capture";

describe("computeClickCapture", () => {
  it("marca risco quando captura < 50% com ≥10 cliques Google", () => {
    const r = computeClickCapture(100, 40);
    assert.equal(r.funnel_risk, true);
    assert.equal(r.click_capture_ratio, 0.4);
    assert.equal(r.click_delta, 60);
  });

  it("não marca risco com amostra pequena ou captura saudável", () => {
    assert.equal(computeClickCapture(9, 1).funnel_risk, false);
    assert.equal(computeClickCapture(100, 60).funnel_risk, false);
  });

  it("sem métricas Google: sem delta/risco", () => {
    const r = computeClickCapture(null, 12);
    assert.equal(r.google_clicks, null);
    assert.equal(r.click_delta, null);
    assert.equal(r.funnel_risk, false);
    assert.equal(r.tracking_clicks, 12);
  });
});

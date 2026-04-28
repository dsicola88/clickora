import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldApplyIdempotencyCheck } from "./idempotency";

describe("shouldApplyIdempotencyCheck", () => {
  it("é false para flag_creative_swap (actualização repetida de optimizer_flags)", () => {
    assert.equal(shouldApplyIdempotencyCheck({ decisionType: "flag_creative_swap", dryRun: false }), false);
  });

  it("é false em dry-run", () => {
    assert.equal(shouldApplyIdempotencyCheck({ decisionType: "pause_campaign", dryRun: true }), false);
  });

  it("é true para pausa/escala em modo live", () => {
    assert.equal(shouldApplyIdempotencyCheck({ decisionType: "pause_campaign", dryRun: false }), true);
    assert.equal(shouldApplyIdempotencyCheck({ decisionType: "scale_budget", dryRun: false }), true);
  });
});

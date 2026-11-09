import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveMaxTrafficRotatorsFromPlan,
  effectiveMaxWorkspaceMembersFromPlan,
  fallbackMaxTrafficRotators,
  fallbackMaxWorkspaceMembers,
} from "./planSeatRotatorLimits";

describe("plan seat / rotator fallbacks", () => {
  it("starter é solo e poucos rotadores", () => {
    assert.equal(fallbackMaxWorkspaceMembers("free_trial"), 1);
    assert.equal(fallbackMaxTrafficRotators("free_trial"), 3);
  });

  it("mensal tem teto; anual ilimitado", () => {
    assert.equal(fallbackMaxWorkspaceMembers("monthly"), 5);
    assert.equal(fallbackMaxTrafficRotators("monthly"), 25);
    assert.equal(fallbackMaxWorkspaceMembers("annual"), null);
    assert.equal(fallbackMaxTrafficRotators("annual"), null);
  });

  it("coluna admin sobrescreve fallback (inclui 0)", () => {
    assert.equal(
      effectiveMaxWorkspaceMembersFromPlan({ type: "annual", maxWorkspaceMembers: 10 }),
      10,
    );
    assert.equal(
      effectiveMaxTrafficRotatorsFromPlan({ type: "free_trial", maxTrafficRotators: 0 }),
      0,
    );
    assert.equal(
      effectiveMaxWorkspaceMembersFromPlan({ type: "monthly", maxWorkspaceMembers: null }),
      5,
    );
  });
});

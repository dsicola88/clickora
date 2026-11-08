import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveMaxPresellAiGenerationsFromPlan,
  monthlyPresellAiLimitForPlanType,
} from "./presellAiQuota";
import { effectiveMaxCustomDomainsFromPlan, fallbackMaxCustomDomainsFromPlanType } from "./customDomainLimits";

describe("presell AI quota admin-configurable", () => {
  it("fallback por tipo quando coluna null", () => {
    assert.equal(monthlyPresellAiLimitForPlanType("free_trial"), 8);
    assert.equal(monthlyPresellAiLimitForPlanType("monthly"), 40);
    assert.equal(monthlyPresellAiLimitForPlanType("annual"), 120);
    assert.equal(
      effectiveMaxPresellAiGenerationsFromPlan({ type: "monthly", maxPresellAiGenerations: null }),
      40,
    );
  });

  it("admin override tem prioridade (inclui 0)", () => {
    assert.equal(
      effectiveMaxPresellAiGenerationsFromPlan({ type: "free_trial", maxPresellAiGenerations: 25 }),
      25,
    );
    assert.equal(
      effectiveMaxPresellAiGenerationsFromPlan({ type: "annual", maxPresellAiGenerations: 0 }),
      0,
    );
    assert.equal(
      effectiveMaxPresellAiGenerationsFromPlan({ type: "monthly", maxPresellAiGenerations: 3.9 }),
      3,
    );
  });
});

describe("custom domain limits admin-configurable", () => {
  it("fallback por tipo quando coluna ausente", () => {
    assert.equal(fallbackMaxCustomDomainsFromPlanType("free_trial"), 0);
    assert.equal(fallbackMaxCustomDomainsFromPlanType("monthly"), 1);
    assert.equal(fallbackMaxCustomDomainsFromPlanType("annual"), 2);
  });

  it("admin override tem prioridade (inclui 0)", () => {
    assert.equal(effectiveMaxCustomDomainsFromPlan({ type: "free_trial", maxCustomDomains: 5 }), 5);
    assert.equal(effectiveMaxCustomDomainsFromPlan({ type: "annual", maxCustomDomains: 0 }), 0);
    assert.equal(effectiveMaxCustomDomainsFromPlan({ type: "monthly", maxCustomDomains: null }), 1);
  });
});

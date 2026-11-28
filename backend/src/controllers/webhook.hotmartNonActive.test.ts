import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hotmartNonActiveDecision, hotmartTokenMatches } from "./webhook.controller";

describe("hotmartNonActiveDecision", () => {
  const base = { mapMissWithConfiguredMap: false, eventPlanId: "plan_monthly" };

  it("cancelamento do mensal antigo após upgrade para anual não toca a assinatura", () => {
    const d = hotmartNonActiveDecision({ ...base, current: { planId: "plan_annual", status: "active" } });
    assert.deepEqual(d, { apply: false, reason: "plan_mismatch" });
  });

  it("reembolso de produto fora do mapa é ignorado", () => {
    const d = hotmartNonActiveDecision({
      ...base,
      mapMissWithConfiguredMap: true,
      current: { planId: "plan_monthly", status: "active" },
    });
    assert.deepEqual(d, { apply: false, reason: "plan_map_miss" });
  });

  it("mesmo plano → aplica", () => {
    const d = hotmartNonActiveDecision({ ...base, current: { planId: "plan_monthly", status: "active" } });
    assert.deepEqual(d, { apply: true });
  });

  it("sem assinatura ou conta suspensa → ignora", () => {
    assert.deepEqual(hotmartNonActiveDecision({ ...base, current: null }), {
      apply: false,
      reason: "no_subscription",
    });
    assert.deepEqual(
      hotmartNonActiveDecision({ ...base, current: { planId: "plan_monthly", status: "suspended" } }),
      { apply: false, reason: "subscription_suspended" },
    );
  });
});

describe("hotmartTokenMatches", () => {
  it("compara em tempo constante e recusa comprimentos diferentes / ausente", () => {
    assert.equal(hotmartTokenMatches("segredo-123", "segredo-123"), true);
    assert.equal(hotmartTokenMatches("segredo-124", "segredo-123"), false);
    assert.equal(hotmartTokenMatches("segredo", "segredo-123"), false);
    assert.equal(hotmartTokenMatches(null, "segredo-123"), false);
  });
});

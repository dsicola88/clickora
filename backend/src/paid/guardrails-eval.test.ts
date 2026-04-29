import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blockingViolationMessagesForApply,
  evaluateGuardrails,
  intersectGeoTargetsWithAllowedCountries,
  type GuardrailLimits,
  type ProposedCampaign,
} from "./guardrails-eval";

const baseLimits = (): GuardrailLimits => ({
  max_daily_budget_micros: 50_000_000,
  max_monthly_spend_micros: 500_000_000,
  max_cpc_micros: null,
  allowed_countries: ["PT", "ES"],
  blocked_keywords: ["casino"],
  require_approval_above_micros: 30_000_000,
});

function proposal(p: Partial<ProposedCampaign>): ProposedCampaign {
  return {
    dailyBudgetMicros: 10_000_000,
    geoTargets: ["PT"],
    keywordTexts: [],
    ...p,
  };
}

describe("evaluateGuardrails", () => {
  it("falha quando não há limites configurados", () => {
    const out = evaluateGuardrails(proposal({}), null);
    assert.equal(out.passed, false);
    assert.ok(out.violations.some((v) => v.code === "missing_guardrails"));
  });

  it("detecta orçamento diário acima do teto", () => {
    const lim = baseLimits();
    const out = evaluateGuardrails(proposal({ dailyBudgetMicros: lim.max_daily_budget_micros + 1 }), lim);
    assert.equal(out.passed, false);
    assert.ok(out.violations.some((v) => v.code === "exceeds_daily_cap"));
  });

  it("detecta países fora da lista quando a lista não está vazia", () => {
    const lim = baseLimits();
    const out = evaluateGuardrails(proposal({ geoTargets: ["US", "PT"] }), lim);
    assert.equal(out.passed, false);
    assert.ok(out.violations.some((v) => v.code === "country_not_allowed"));
  });

  it("lista de países permitidos vazia não bloqueia geografias", () => {
    const lim = { ...baseLimits(), allowed_countries: [] };
    const out = evaluateGuardrails(proposal({ geoTargets: ["BR", "JP"] }), lim);
    assert.ok(!out.violations.some((v) => v.code === "country_not_allowed"));
  });

  it("detecta palavras-chave bloqueadas", () => {
    const lim = baseLimits();
    const out = evaluateGuardrails(proposal({ keywordTexts: ["Casino", "hotel"] }), lim);
    assert.equal(out.passed, false);
    assert.ok(out.violations.some((v) => v.code === "blocked_keyword"));
  });
});

describe("intersectGeoTargetsWithAllowedCountries", () => {
  it("com lista vazia devolve geo normalizada deduplicada", () => {
    const out = intersectGeoTargetsWithAllowedCountries([" pt ", "PT", "es"], []);
    assert.deepEqual(out, ["PT", "ES"]);
  });

  it("com lista permitida filtra e mantém ordem", () => {
    const out = intersectGeoTargetsWithAllowedCountries(["PT", "DE", "es"], ["ES", "PT"]);
    assert.deepEqual(out, ["PT", "ES"]);
  });
});

describe("blockingViolationMessagesForApply", () => {
  it("não inclui exceeds_approval_threshold como bloqueio de aplicar", () => {
    const lim = baseLimits();
    const prop = proposal({
      dailyBudgetMicros: lim.require_approval_above_micros! + 1,
      geoTargets: ["PT"],
    });
    const msgs = blockingViolationMessagesForApply(lim, prop);
    assert.ok(!msgs.some((m) => /aprovação manual/i.test(m)));
    assert.ok(msgs.length === 0);
  });
});

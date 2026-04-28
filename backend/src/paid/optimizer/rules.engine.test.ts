import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { evaluateOptimizerRules } from "./rules.engine";

const KEYS = [
  "PAID_OPTIMIZER_RULES",
  "PAID_OPTIMIZER_PAUSE_SPEND_USD",
  "PAID_OPTIMIZER_SCALE_ROAS_MIN",
  "PAID_OPTIMIZER_CTR_LOW",
] as const;

function stashEnv(): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {};
  for (const k of KEYS) o[k] = process.env[k];
  return o;
}

function restoreEnv(prev: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
}

describe("evaluateOptimizerRules", () => {
  let prev: Record<string, string | undefined>;

  afterEach(() => {
    restoreEnv(prev);
  });

  it("pausa quando gasto ≥ limiar, zero conversões e cliques suficientes", () => {
    prev = stashEnv();
    process.env.PAID_OPTIMIZER_RULES = "all";
    process.env.PAID_OPTIMIZER_PAUSE_SPEND_USD = "10";

    const out = evaluateOptimizerRules({
      platform: "google_ads",
      spendUsdPlatform: 12,
      tracking: {
        clicks: 10,
        impressions: 1000,
        conversionEvents: 0,
        approvedConversions: 0,
        revenueUsd: 0,
      },
    });

    const pause = out.find((c) => c.decisionType === "pause_campaign");
    assert.ok(pause);
    assert.equal(pause?.ruleCode, "pause_zero_conv_min_spend");
  });

  it("escala quando ROAS ≥ limiar e não há candidato de pausa", () => {
    prev = stashEnv();
    process.env.PAID_OPTIMIZER_RULES = "all";
    process.env.PAID_OPTIMIZER_PAUSE_SPEND_USD = "99999";
    process.env.PAID_OPTIMIZER_SCALE_ROAS_MIN = "2";

    const out = evaluateOptimizerRules({
      platform: "meta_ads",
      spendUsdPlatform: 50,
      tracking: {
        clicks: 20,
        impressions: 5000,
        conversionEvents: 0,
        approvedConversions: 0,
        revenueUsd: 150,
      },
    });

    const scale = out.find((c) => c.decisionType === "scale_budget");
    assert.ok(scale);
    assert.equal(scale?.ruleCode, "scale_budget_high_roas");
  });

  it("marca CTR baixo quando impressões e CTR abaixo do limiar", () => {
    prev = stashEnv();
    process.env.PAID_OPTIMIZER_RULES = "all";
    process.env.PAID_OPTIMIZER_CTR_LOW = "0.02";

    const out = evaluateOptimizerRules({
      platform: "google_ads",
      spendUsdPlatform: 2,
      tracking: {
        clicks: 1,
        impressions: 1000,
        conversionEvents: 0,
        approvedConversions: 0,
        revenueUsd: 0,
      },
    });

    const flag = out.find((c) => c.decisionType === "flag_creative_swap");
    assert.ok(flag);
    assert.equal(flag?.ruleCode, "ctr_below_threshold");
  });

  it("em pause_only não devolve escala nem flag CTR", () => {
    prev = stashEnv();
    delete process.env.PAID_OPTIMIZER_RULES;

    const out = evaluateOptimizerRules({
      platform: "google_ads",
      spendUsdPlatform: 50,
      tracking: {
        clicks: 20,
        impressions: 5000,
        conversionEvents: 0,
        approvedConversions: 0,
        revenueUsd: 500,
      },
    });

    assert.equal(out.some((c) => c.decisionType === "scale_budget"), false);
    assert.equal(out.some((c) => c.decisionType === "flag_creative_swap"), false);
  });

  it("prioriza pausa sobre escala no mesmo ciclo", () => {
    prev = stashEnv();
    process.env.PAID_OPTIMIZER_RULES = "all";
    process.env.PAID_OPTIMIZER_PAUSE_SPEND_USD = "10";
    process.env.PAID_OPTIMIZER_SCALE_ROAS_MIN = "2";

    const out = evaluateOptimizerRules({
      platform: "google_ads",
      spendUsdPlatform: 20,
      tracking: {
        clicks: 10,
        impressions: 1000,
        conversionEvents: 0,
        approvedConversions: 0,
        revenueUsd: 100,
      },
    });

    assert.ok(out.some((c) => c.decisionType === "pause_campaign"));
    assert.equal(out.some((c) => c.decisionType === "scale_budget"), false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRotatorRulesPolicy,
  ruleWhenMatches,
  utcHourInWindow,
  type RuleEvaluationContext,
} from "./evaluate";
import type { RotatorRulesPolicy } from "./schema";

describe("utcHourInWindow", () => {
  it("intervalo normal inclusivo", () => {
    assert.equal(utcHourInWindow(9, 9, 17), true);
    assert.equal(utcHourInWindow(17, 9, 17), true);
    assert.equal(utcHourInWindow(8, 9, 17), false);
    assert.equal(utcHourInWindow(18, 9, 17), false);
  });
  it("atravessa meia-noite", () => {
    assert.equal(utcHourInWindow(23, 22, 6), true);
    assert.equal(utcHourInWindow(3, 22, 6), true);
    assert.equal(utcHourInWindow(10, 22, 6), false);
  });
});

describe("ruleWhenMatches", () => {
  const baseCtx = (over: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext => ({
    country: "PT",
    device: "mobile",
    now: new Date("2026-06-15T14:30:00.000Z"),
    ...over,
  });

  it("país allow/deny", () => {
    assert.equal(
      ruleWhenMatches({ countries_allow: ["PT"] }, baseCtx({ country: "PT" })),
      true,
    );
    assert.equal(
      ruleWhenMatches({ countries_allow: ["US"] }, baseCtx({ country: "PT" })),
      false,
    );
    assert.equal(
      ruleWhenMatches({ countries_deny: ["PT"] }, baseCtx({ country: "PT" })),
      true,
    );
    assert.equal(
      ruleWhenMatches({ countries_deny: ["PT"] }, baseCtx({ country: "US" })),
      false,
    );
  });

  it("dispositivo", () => {
    assert.equal(ruleWhenMatches({ device: "mobile" }, baseCtx({ device: "mobile" })), true);
    assert.equal(ruleWhenMatches({ device: "mobile" }, baseCtx({ device: "tablet" })), true);
    assert.equal(ruleWhenMatches({ device: "desktop" }, baseCtx({ device: "mobile" })), false);
  });

  it("weekday UTC", () => {
    // 2026-06-15 é segunda (1)
    assert.equal(ruleWhenMatches({ weekdays_utc: [1] }, baseCtx()), true);
    assert.equal(ruleWhenMatches({ weekdays_utc: [0] }, baseCtx()), false);
  });

  it("cap cliques diários", () => {
    assert.equal(
      ruleWhenMatches({ max_rotator_clicks_today_utc: 100 }, baseCtx({ rotatorClicksTodayUtc: 50 })),
      true,
    );
    assert.equal(
      ruleWhenMatches({ max_rotator_clicks_today_utc: 100 }, baseCtx({ rotatorClicksTodayUtc: 100 })),
      false,
    );
  });
});

describe("evaluateRotatorRulesPolicy", () => {
  const ctx: RuleEvaluationContext = {
    country: "BR",
    device: "desktop",
    now: new Date("2026-01-10T12:00:00.000Z"),
  };

  it("primeira regra ganha — block", () => {
    const p: RotatorRulesPolicy = {
      version: 1,
      rules: [
        { when: { countries_deny: ["BR"] }, action: { type: "block" } },
        { when: {}, action: { type: "continue" } },
      ],
    };
    assert.deepEqual(evaluateRotatorRulesPolicy(p, ctx), { effect: "block" });
  });

  it("redirect", () => {
    const p: RotatorRulesPolicy = {
      version: 1,
      rules: [{ when: { device: "desktop" }, action: { type: "redirect", url: "https://exemplo.test/off" } }],
    };
    assert.deepEqual(evaluateRotatorRulesPolicy(p, ctx), {
      effect: "redirect",
      url: "https://exemplo.test/off",
    });
  });

  it("use_backup", () => {
    const p: RotatorRulesPolicy = {
      version: 1,
      rules: [{ when: {}, action: { type: "use_backup" } }],
    };
    assert.deepEqual(evaluateRotatorRulesPolicy(p, ctx), { effect: "use_backup" });
  });

  it("null policy → continue", () => {
    assert.deepEqual(evaluateRotatorRulesPolicy(null, ctx), { effect: "continue" });
  });
});

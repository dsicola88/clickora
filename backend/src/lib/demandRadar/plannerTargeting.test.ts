import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePlannerLanguage,
  normalizePlannerMarket,
  PLANNER_LANGUAGE_CODES,
  PLANNER_MARKET_CODES,
} from "./plannerTargeting";

test("normalizePlannerMarket: códigos Google reais; UK→GB; sem inventar", () => {
  assert.equal(normalizePlannerMarket("US"), "US");
  assert.equal(normalizePlannerMarket("br"), "BR");
  assert.equal(normalizePlannerMarket("UK"), "GB");
  assert.equal(normalizePlannerMarket("Brasil"), "BR");
  assert.equal(normalizePlannerMarket("XX"), null);
  assert.equal(normalizePlannerMarket(""), null);
  assert.ok(PLANNER_MARKET_CODES.includes("GB"));
  assert.ok(!PLANNER_MARKET_CODES.includes("UK"));
});

test("normalizePlannerLanguage: códigos Google reais; sem fallback en", () => {
  assert.equal(normalizePlannerLanguage("en"), "en");
  assert.equal(normalizePlannerLanguage("PT"), "pt");
  assert.equal(normalizePlannerLanguage("português"), "pt");
  assert.equal(normalizePlannerLanguage("xx"), null);
  assert.equal(normalizePlannerLanguage(""), null);
  assert.ok(PLANNER_LANGUAGE_CODES.includes("en"));
  assert.ok(PLANNER_LANGUAGE_CODES.includes("zh"));
});

test("listas planner cobrem todos os criterion IDs usados", () => {
  assert.ok(PLANNER_MARKET_CODES.length >= 30);
  assert.ok(PLANNER_LANGUAGE_CODES.length >= 20);
  for (const code of PLANNER_MARKET_CODES) {
    assert.equal(normalizePlannerMarket(code), code);
  }
  for (const code of PLANNER_LANGUAGE_CODES) {
    assert.equal(normalizePlannerLanguage(code), code);
  }
});

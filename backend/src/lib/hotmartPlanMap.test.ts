import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { inspectHotmartPlanMapConfig, resolvePlanType } from "./hotmartPlanMap";

describe("hotmartPlanMap", () => {
  const prevMap = process.env.HOTMART_PLAN_MAP;
  const prevDefault = process.env.HOTMART_DEFAULT_PLAN_TYPE;

  beforeEach(() => {
    process.env.HOTMART_PLAN_MAP = JSON.stringify({
      offer_annual: "annual",
      prod_monthly: "monthly",
    });
    process.env.HOTMART_DEFAULT_PLAN_TYPE = "monthly";
  });

  afterEach(() => {
    if (prevMap === undefined) delete process.env.HOTMART_PLAN_MAP;
    else process.env.HOTMART_PLAN_MAP = prevMap;
    if (prevDefault === undefined) delete process.env.HOTMART_DEFAULT_PLAN_TYPE;
    else process.env.HOTMART_DEFAULT_PLAN_TYPE = prevDefault;
  });

  it("resolvePlanType bate na oferta", () => {
    const r = resolvePlanType("prod_monthly", "offer_annual");
    assert.equal(r.planType, "annual");
    assert.equal(r.matched, true);
    assert.equal(r.source, "map");
  });

  it("resolvePlanType miss → fallback", () => {
    const r = resolvePlanType("x", "y");
    assert.equal(r.planType, "monthly");
    assert.equal(r.matched, false);
  });

  it("inspect mostra chaves sem secrets", () => {
    const i = inspectHotmartPlanMapConfig();
    assert.equal(i.map_configured, true);
    assert.equal(i.map_entry_count, 2);
    assert.ok(i.map_keys.includes("offer_annual"));
    assert.equal(i.default_plan_type, "monthly");
    assert.equal(i.parse_error, null);
  });

  it("inspect sem mapa avisa risco", () => {
    delete process.env.HOTMART_PLAN_MAP;
    const i = inspectHotmartPlanMapConfig();
    assert.equal(i.map_configured, false);
    assert.match(i.hint, /HOTMART_PLAN_MAP/);
  });
});

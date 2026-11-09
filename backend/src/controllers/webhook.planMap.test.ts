import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { resolvePlanType } from "./webhook.controller";

describe("resolvePlanType re-export", () => {
  const prevMap = process.env.HOTMART_PLAN_MAP;
  const prevDefault = process.env.HOTMART_DEFAULT_PLAN_TYPE;

  beforeEach(() => {
    process.env.HOTMART_PLAN_MAP = JSON.stringify({ offer_annual: "annual" });
    process.env.HOTMART_DEFAULT_PLAN_TYPE = "monthly";
  });

  afterEach(() => {
    if (prevMap === undefined) delete process.env.HOTMART_PLAN_MAP;
    else process.env.HOTMART_PLAN_MAP = prevMap;
    if (prevDefault === undefined) delete process.env.HOTMART_DEFAULT_PLAN_TYPE;
    else process.env.HOTMART_DEFAULT_PLAN_TYPE = prevDefault;
  });

  it("re-export mantém contrato", () => {
    const r = resolvePlanType(null, "offer_annual");
    assert.equal(r.planType, "annual");
    assert.equal(r.matched, true);
  });
});

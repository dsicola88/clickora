import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveAutoBlacklistThreshold } from "./trackingGuardPolicy";

describe("effectiveAutoBlacklistThreshold", () => {
  it("0 desliga", () => {
    assert.equal(effectiveAutoBlacklistThreshold(0), 0);
    assert.equal(effectiveAutoBlacklistThreshold(-3), 0);
  });

  it("1–29 sobe para 30", () => {
    assert.equal(effectiveAutoBlacklistThreshold(1), 30);
    assert.equal(effectiveAutoBlacklistThreshold(29), 30);
  });

  it("30 ou mais mantém-se", () => {
    assert.equal(effectiveAutoBlacklistThreshold(30), 30);
    assert.equal(effectiveAutoBlacklistThreshold(80), 80);
    assert.equal(effectiveAutoBlacklistThreshold(9000), 5000);
  });
});

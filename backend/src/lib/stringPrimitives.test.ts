import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { onlyDigits, parseIpv4Blacklist, pickString } from "./stringPrimitives";

describe("stringPrimitives", () => {
  it("pickString devolve o primeiro não-vazio", () => {
    assert.equal(pickString("", "  ", "ok", "x"), "ok");
    assert.equal(pickString(1, null, undefined), null);
  });

  it("onlyDigits", () => {
    assert.equal(onlyDigits("a1b2"), "12");
    assert.equal(onlyDigits("---"), null);
    assert.equal(onlyDigits(null), null);
  });

  it("parseIpv4Blacklist", () => {
    assert.equal(parseIpv4Blacklist(" 8.8.8.8 "), "8.8.8.8");
    assert.equal(parseIpv4Blacklist("999.1.1.1"), null);
    assert.equal(parseIpv4Blacklist("not-an-ip"), null);
  });
});

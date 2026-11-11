import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cleanAdClickId,
  compactTrackingMeta,
  firstQueryString,
  parseCsvSimple,
  requestCookieValue,
} from "./trackQueryHelpers";

describe("trackQueryHelpers", () => {
  it("cleanAdClickId ignora macros e vazios", () => {
    assert.equal(cleanAdClickId("{gclid}"), undefined);
    assert.equal(cleanAdClickId("  "), undefined);
    assert.equal(cleanAdClickId("abc123"), "abc123");
  });

  it("firstQueryString lê string e array", () => {
    assert.equal(firstQueryString({ a: " x " }, "a"), "x");
    assert.equal(firstQueryString({ a: ["y", "z"] }, "a"), "y");
    assert.equal(firstQueryString({}, "a"), undefined);
  });

  it("compactTrackingMeta remove vazios", () => {
    assert.deepEqual(compactTrackingMeta({ a: 1, b: "", c: null, d: "ok" }), { a: 1, d: "ok" });
  });

  it("parseCsvSimple", () => {
    assert.deepEqual(parseCsvSimple('a,b\n"c",d\n'), [
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("requestCookieValue", () => {
    const req = { headers: { cookie: "_fbp=fb.1.2; other=1" } } as Parameters<typeof requestCookieValue>[0];
    assert.equal(requestCookieValue(req, "_fbp"), "fb.1.2");
    assert.equal(requestCookieValue(req, "missing"), undefined);
  });
});

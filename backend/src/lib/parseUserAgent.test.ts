import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDeviceLabel, parseUserAgent } from "./parseUserAgent";

describe("parseUserAgent", () => {
  it("Firefox Mac como BuyGoods", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:156.0) Gecko/20100101 Firefox/156.0";
    const p = parseUserAgent(ua);
    assert.equal(p.os, "Mac OS X");
    assert.equal(p.browser, "Firefox");
    assert.equal(p.device, "desktop");
    assert.equal(formatDeviceLabel(p), "Mac OS X · Firefox");
  });

  it("iPhone Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const p = parseUserAgent(ua);
    assert.equal(p.device, "mobile");
    assert.equal(p.os, "iOS");
    assert.equal(p.browser, "Safari");
  });
});

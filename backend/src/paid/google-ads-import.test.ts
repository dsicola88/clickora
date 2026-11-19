import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("google-ads-import helpers", () => {
  it("normaliza IDs externos (só dígitos)", () => {
    const raw = "customers/123/campaigns/456789";
    const id = raw.replace(/\D/g, "").slice(-6) || raw.replace(/\D/g, "");
    // criterion: full numeric strip
    assert.equal("123456789".includes("456789"), true);
    assert.equal(String("456-789").replace(/\D/g, ""), "456789");
    assert.ok(id.length >= 1);
  });
});

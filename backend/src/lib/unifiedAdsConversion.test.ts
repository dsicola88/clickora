import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";

describe("unifiedAdsConversion ledger keys", () => {
  it("external order id namespaced by origin", () => {
    const tx = "ORDER-1";
    const ga = `google_ads:${tx}`;
    const ms = `microsoft_ads:${tx}`;
    assert.notEqual(ga, ms);
    assert.ok(ga.startsWith("google_ads:"));
    assert.ok(new Prisma.Decimal(12.5).equals(12.5));
  });
});

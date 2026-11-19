import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGoogleAdsDateRange } from "./google-ads-connection";

describe("search terms date presets (shared)", () => {
  it("last_7 válido para GAQL search_term_view", () => {
    const r = resolveGoogleAdsDateRange("last_7");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.from.length, 10);
    assert.equal(r.to.length, 10);
  });
});

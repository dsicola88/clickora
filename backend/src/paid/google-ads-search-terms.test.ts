import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGoogleAdsDateRange } from "./google-ads-connection";
import {
  collectNegativeKeywordTexts,
  isSearchTermWasteCandidate,
} from "./google-ads-search-terms.service";

describe("search terms date presets (shared)", () => {
  it("last_7 válido para GAQL search_term_view", () => {
    const r = resolveGoogleAdsDateRange("last_7");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.equal(r.from.length, 10);
    assert.equal(r.to.length, 10);
  });
});

describe("isSearchTermWasteCandidate", () => {
  it("marca gasto ≥ $5 sem conversões", () => {
    assert.equal(isSearchTermWasteCandidate(5_000_000, 0), true);
    assert.equal(isSearchTermWasteCandidate(12_000_000, 0.2), true);
  });

  it("não marca gasto baixo ou com conversões", () => {
    assert.equal(isSearchTermWasteCandidate(4_999_999, 0), false);
    assert.equal(isSearchTermWasteCandidate(20_000_000, 1), false);
    assert.equal(isSearchTermWasteCandidate(5_000_000, 0.5), false);
  });
});

describe("collectNegativeKeywordTexts", () => {
  it("une campanha e ad-group sem duplicados", () => {
    const s = collectNegativeKeywordTexts({
      campaignNegatives: [{ text: " Free " }, { text: "job" }],
      adGroupNegatives: [{ text: "FREE" }, { text: "cheap" }],
    });
    assert.equal(s.size, 3);
    assert.ok(s.has("free"));
    assert.ok(s.has("job"));
    assert.ok(s.has("cheap"));
  });
});

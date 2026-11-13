import { describe, expect, it } from "vitest";
import { looksLikeAffiliateHopOnlyUrl } from "./presellAffiliateHop";

describe("looksLikeAffiliateHopOnlyUrl", () => {
  it("flags Knownwalk hop that does not generate a product page", () => {
    expect(looksLikeAffiliateHopOnlyUrl("https://www.knownwalk.com/2MSQQZ2M/22JQ9DB7/")).toBe(true);
  });

  it("allows real sales pages", () => {
    expect(looksLikeAffiliateHopOnlyUrl("https://melaramax.com/")).toBe(false);
  });
});

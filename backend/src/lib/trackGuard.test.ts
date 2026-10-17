import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGoogleAdsCrawlerUserAgent } from "./detectBot";

describe("trackGuard / Ads crawlers", () => {
  it("identifica AdsBot e Google Inspection Tool", () => {
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)"), true);
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; Google-InspectionTool/1.0)"), true);
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), false);
  });
});

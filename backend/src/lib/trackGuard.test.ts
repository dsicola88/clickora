import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGoogleAdsCrawlerUserAgent,
  isProtectedGoogleCrawlerUserAgent,
} from "./detectBot";
import { isIntentionalPublicPageCloakReason } from "./trackingGuardPolicy";

describe("trackGuard / Ads crawlers", () => {
  it("identifica AdsBot e Google Inspection Tool", () => {
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)"), true);
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; Google-InspectionTool/1.0)"), true);
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), false);
  });

  it("AdsBot/Googlebot são crawlers protegidos (landing + hop)", () => {
    assert.equal(
      isProtectedGoogleCrawlerUserAgent(
        "Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)",
      ),
      true,
    );
    assert.equal(
      isProtectedGoogleCrawlerUserAgent(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
      true,
    );
    assert.equal(
      isProtectedGoogleCrawlerUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      false,
    );
  });

  it("whitelist/blacklist podem cloakar landing; bot/proxy não", () => {
    assert.equal(isIntentionalPublicPageCloakReason("whitelist"), true);
    assert.equal(isIntentionalPublicPageCloakReason("bot_blocked"), false);
  });
});

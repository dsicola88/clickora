import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  isGoogleAdsCrawlerUserAgent,
  isProtectedGoogleCrawlerUserAgent,
} from "./detectBot";
import { isIntentionalPublicPageCloakReason } from "./trackingGuardPolicy";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

describe("detectBot / classificação de crawlers (só para relatórios)", () => {
  it("identifica AdsBot e Google Inspection Tool", () => {
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)"), true);
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; Google-InspectionTool/1.0)"), true);
    assert.equal(isGoogleAdsCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), false);
  });

  it("classifica Googlebot e AdsBot, mas não um iPhone", () => {
    assert.equal(isProtectedGoogleCrawlerUserAgent("Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)"), true);
    assert.equal(isProtectedGoogleCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
    assert.equal(isProtectedGoogleCrawlerUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"), false);
  });

  it("whitelist/blacklist/bot/proxy não trocam a landing", () => {
    assert.equal(isIntentionalPublicPageCloakReason("whitelist"), false);
    assert.equal(isIntentionalPublicPageCloakReason("blacklist"), false);
    assert.equal(isIntentionalPublicPageCloakReason("bot_blocked"), false);
  });
});

/**
 * Google Ads: o mesmo clique válido tem de seguir o mesmo caminho para bots e humanos.
 * Estes testes falham se alguém reintroduzir decisões por User-Agent / país no hop ou na landing.
 */
describe("sem tratamento diferenciado por User-Agent ou país", () => {
  for (const file of [
    "controllers/track.controller.ts",
    "controllers/presell.controller.ts",
    "lib/trackGuard.ts",
  ]) {
    it(`${file} não ramifica por crawler Google`, () => {
      const src = read(file);
      assert.equal(/isProtectedGoogleCrawlerUserAgent|isGoogleAdsCrawlerUserAgent/.test(src), false);
    });
  }

  it("hop e landing não aplicam cloak por país", () => {
    for (const file of ["controllers/track.controller.ts", "controllers/presell.controller.ts"]) {
      const src = read(file);
      assert.equal(/countryOnCloakDenyList|shouldServeCloakSafePage|buildCloakSafePublicPayload/.test(src), false, file);
    }
  });
});

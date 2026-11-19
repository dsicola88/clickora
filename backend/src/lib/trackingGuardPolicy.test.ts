import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveAutoBlacklistThreshold,
  isIntentionalPublicPageCloakReason,
  shouldBypassProxyBlockForPaidClick,
} from "./trackingGuardPolicy";

describe("effectiveAutoBlacklistThreshold", () => {
  it("0 desliga", () => {
    assert.equal(effectiveAutoBlacklistThreshold(0), 0);
    assert.equal(effectiveAutoBlacklistThreshold(-3), 0);
  });

  it("1–29 sobe para 30", () => {
    assert.equal(effectiveAutoBlacklistThreshold(1), 30);
    assert.equal(effectiveAutoBlacklistThreshold(29), 30);
  });

  it("30 ou mais mantém-se", () => {
    assert.equal(effectiveAutoBlacklistThreshold(30), 30);
    assert.equal(effectiveAutoBlacklistThreshold(80), 80);
    assert.equal(effectiveAutoBlacklistThreshold(9000), 5000);
  });
});

describe("public page cloak vs Ads", () => {
  it("só blacklist/whitelist trocam a landing", () => {
    assert.equal(isIntentionalPublicPageCloakReason("blacklist"), true);
    assert.equal(isIntentionalPublicPageCloakReason("whitelist"), true);
    assert.equal(isIntentionalPublicPageCloakReason("bot_blocked"), false);
    assert.equal(isIntentionalPublicPageCloakReason("proxy_blocked"), false);
    assert.equal(isIntentionalPublicPageCloakReason("rate_limit"), false);
    assert.equal(isIntentionalPublicPageCloakReason("empty_user_agent"), false);
  });

  it("proxy + gclid real não bloqueia o hop de oferta", () => {
    assert.equal(
      shouldBypassProxyBlockForPaidClick({
        guardReason: "proxy_blocked",
        gclid: "Cj0KCQjwTestPaidClick",
      }),
      true,
    );
    assert.equal(
      shouldBypassProxyBlockForPaidClick({
        guardReason: "proxy_blocked",
        gclid: "{gclid}",
      }),
      false,
    );
    assert.equal(
      shouldBypassProxyBlockForPaidClick({
        guardReason: "bot_blocked",
        gclid: "Cj0KCQjwTestPaidClick",
      }),
      false,
    );
  });
});

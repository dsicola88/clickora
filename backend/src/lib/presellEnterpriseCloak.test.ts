import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  buildCloakSafePublicPayload,
  countryOnCloakDenyList,
  shouldServeCloakSafePage,
} from "./presellEnterpriseCloak";

function mockReq(ua: string, ip = "8.8.8.8"): Request {
  return {
    headers: { "user-agent": ua, "x-forwarded-for": ip },
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

describe("presellEnterpriseCloak", () => {
  it("cloak off → false", () => {
    const r = shouldServeCloakSafePage(mockReq("Googlebot/2.1"), { enterpriseCloak: false });
    assert.equal(r.cloak, false);
  });

  it("cloak on + bot UA → false (o UA não muda a página)", () => {
    const r = shouldServeCloakSafePage(mockReq("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), {
      enterpriseCloak: true,
    });
    assert.equal(r.cloak, false);
  });

  it("país na lista → true; fora da lista → false", () => {
    assert.equal(countryOnCloakDenyList({ enterpriseCloak: true, cloakGeoDeny: "CN, RU" }, "cn"), true);
    assert.equal(countryOnCloakDenyList({ enterpriseCloak: true, cloakGeoDeny: "CN" }, "PT"), false);
    assert.equal(countryOnCloakDenyList({ enterpriseCloak: false, cloakGeoDeny: "CN" }, "CN"), false);
    assert.equal(countryOnCloakDenyList({ enterpriseCloak: true, cloakGeoDeny: "CN" }, null), false);
  });

  it("cloak on + human UA → false (sem geo deny)", () => {
    const r = shouldServeCloakSafePage(
      mockReq(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ),
      { enterpriseCloak: true },
    );
    assert.equal(r.cloak, false);
  });

  it("buildCloakSafePublicPayload strips mirror/hoplink", () => {
    const payload = buildCloakSafePublicPayload({
      base: {
        id: "x",
        title: "Produto X",
        type: "desconto",
        video_url: "https://video.example/v",
        content: {
          importMirrorSrcDoc: "<html>huge</html>",
          affiliateLink: "https://offer.example/go",
          title: "old",
        },
        tracking: { offerUrl: "https://offer.example/go" },
        settings: { exitPopup: true, socialProof: true, headerCode: "<script>x</script>" },
      },
      settingsRaw: {
        enterpriseCloak: true,
        cloakSafeTitle: "Safe title",
        cloakSafeBody: "Safe body text",
      },
      reason: "bot:google",
    });
    assert.equal(payload.cloak_safe, true);
    assert.equal(payload.cloak_reason, undefined);
    assert.equal(payload.title, "Safe title");
    assert.equal(payload.type, "tsl");
    assert.equal(payload.video_url, undefined);
    const content = payload.content as Record<string, unknown>;
    assert.equal(content.title, "Safe title");
    assert.equal(content.salesText, "Safe body text");
    assert.equal(content.affiliateLink, "#");
    assert.equal(content.importMirrorSrcDoc, "");
    const settings = payload.settings as Record<string, unknown>;
    assert.equal(settings.enterpriseCloak, true);
    assert.equal(settings.exitPopup, false);
    assert.equal(settings.headerCode, undefined);
    const tracking = payload.tracking as Record<string, unknown>;
    assert.deepEqual(tracking, {});
  });
});

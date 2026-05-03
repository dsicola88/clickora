import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendClickIdToAffiliateUrl } from "./appendClickIdToUrl";

describe("appendClickIdToAffiliateUrl", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

  it("acrescenta clickora_click_id e cid/clickid quando ausentes", () => {
    const out = appendClickIdToAffiliateUrl("https://offer.test/buy?a=1", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("a"), "1");
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
    assert.equal(u.searchParams.get("cid"), uuid);
    assert.equal(u.searchParams.get("clickid"), uuid);
  });

  it("não substitui cid nem clickid já definidos pela rede", () => {
    const out = appendClickIdToAffiliateUrl(
      "https://offer.test/go?cid=NETTOKEN&clickid=OTHER",
      uuid,
    );
    const u = new URL(out);
    assert.equal(u.searchParams.get("cid"), "NETTOKEN");
    assert.equal(u.searchParams.get("clickid"), "OTHER");
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
  });
});

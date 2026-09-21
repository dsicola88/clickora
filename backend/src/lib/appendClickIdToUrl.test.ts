import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendClickIdToAffiliateUrl } from "./appendClickIdToUrl";

describe("appendClickIdToAffiliateUrl", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

  it("acrescenta clickora_click_id e aliases BuyGoods/SmartAdv/Digistore quando ausentes", () => {
    const out = appendClickIdToAffiliateUrl("https://offer.test/buy?a=1", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("a"), "1");
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
    assert.equal(u.searchParams.get("cid"), uuid);
    assert.equal(u.searchParams.get("clickid"), uuid);
    assert.equal(u.searchParams.get("sid1"), uuid);
    assert.equal(u.searchParams.get("subid"), uuid);
    assert.equal(u.searchParams.get("subid1"), uuid);
    assert.equal(u.searchParams.get("sub1"), uuid);
    assert.equal(u.searchParams.get("sub3"), uuid);
    assert.equal(u.searchParams.get("s1"), uuid);
    assert.equal(u.searchParams.get("s2"), uuid);
  });

  it("não substitui cid/clickid/subid já definidos pela rede", () => {
    const out = appendClickIdToAffiliateUrl(
      "https://offer.test/go?cid=NETTOKEN&clickid=OTHER&subid=KEEP",
      uuid,
    );
    const u = new URL(out);
    assert.equal(u.searchParams.get("cid"), "NETTOKEN");
    assert.equal(u.searchParams.get("clickid"), "OTHER");
    assert.equal(u.searchParams.get("subid"), "KEEP");
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
    assert.equal(u.searchParams.get("sid1"), uuid);
    assert.equal(u.searchParams.get("sub3"), uuid);
  });
});

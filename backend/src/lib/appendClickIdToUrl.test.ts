import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendClickIdToAffiliateUrl } from "./appendClickIdToUrl";

describe("appendClickIdToAffiliateUrl", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

  it("em domínio desconhecido escreve subid, que a MaxWeb devolve", () => {
    const out = appendClickIdToAffiliateUrl("https://offer.test/buy?a=1", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("a"), "1");
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
    assert.equal(u.searchParams.get("subid"), uuid);
    assert.equal(u.searchParams.get("cid"), null);
    assert.equal(u.searchParams.get("sub3"), null);
    assert.equal(u.searchParams.get("s1"), null);
  });

  it("um hop MaxWeb num domínio próprio recebe subid", () => {
    const out = appendClickIdToAffiliateUrl("https://mwebkivo.com/go?a=1", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("subid"), uuid);
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
    assert.equal(u.searchParams.get("cid"), null);
  });

  it("Digistore recebe cid e sid1, não subid", () => {
    const out = appendClickIdToAffiliateUrl("https://www.digistore24.com/redir/x/y/?a=1", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("cid"), uuid);
    assert.equal(u.searchParams.get("sid1"), uuid);
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
    assert.equal(u.searchParams.get("subid"), null);
    assert.equal(u.searchParams.get("sub3"), null);
  });

  it("não substitui cid já definido e ainda preenche sid1", () => {
    const out = appendClickIdToAffiliateUrl(
      "https://www.digistore24.com/redir/x/y/?cid=OTHER_TRACKER_TOKEN",
      uuid,
    );
    const u = new URL(out);
    assert.equal(u.searchParams.get("cid"), "OTHER_TRACKER_TOKEN");
    assert.equal(u.searchParams.get("sid1"), uuid);
    assert.equal(u.searchParams.get("clickora_click_id"), uuid);
  });

  it("BuyGoods recebe subid e não cid", () => {
    const out = appendClickIdToAffiliateUrl("https://www.buygoods.com/x?cid=OTHER", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("cid"), "OTHER");
    assert.equal(u.searchParams.get("subid"), uuid);
    assert.equal(u.searchParams.get("sub3"), null);
  });

  it("platform explícita isola SmartAdv num host desconhecido", () => {
    const out = appendClickIdToAffiliateUrl("https://offer.test/go", uuid, "SmartAdv");
    const u = new URL(out);
    assert.equal(u.searchParams.get("sub3"), uuid);
    assert.equal(u.searchParams.get("cid"), null);
    assert.equal(u.searchParams.get("subid"), null);
  });

  it("Hotmart escreve src", () => {
    const out = appendClickIdToAffiliateUrl("https://pay.hotmart.com/ABC", uuid);
    const u = new URL(out);
    assert.equal(u.searchParams.get("src"), uuid);
    assert.equal(u.searchParams.get("subid"), null);
  });
});

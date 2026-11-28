import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLiteImpressionPixelUrl,
  buildOfferForwardParamKeys,
  liteOfferForwardParams,
  liteTrackClickParams,
} from "./buildLiteImpressionPixelUrl";

describe("buildLiteImpressionPixelUrl", () => {
  it("preserva gclid real e ignora macro", () => {
    const url = buildLiteImpressionPixelUrl("https://go.example.com/api", "11111111-1111-4111-8111-111111111111", {
      query: {
        gclid: "RealGclid123",
        utm_source: "google",
      },
      headers: { referer: "https://ads.google.com/" },
    });
    assert.match(url, /\/track\/pixel\/11111111/);
    assert.match(url, /gclid=RealGclid123/);
    assert.match(url, /utm_source=google/);
    assert.doesNotMatch(url, /\{gclid\}/);
  });

  it("pixel leva chaves Voluum (clickid, var1…) como a SPA", () => {
    const url = buildLiteImpressionPixelUrl("https://go.example.com/api", "11111111-1111-4111-8111-111111111111", {
      query: { clickid: "VX1", var3: "v3", cost: "{cost}" },
      headers: {},
    });
    assert.match(url, /clickid=VX1/);
    assert.match(url, /var3=v3/);
    assert.doesNotMatch(url, /cost=/);
  });
});

describe("liteTrackClickParams", () => {
  it("clickora_click_id → parent_click_id (só UUID), Voluum e cookies _fbp/_ttp", () => {
    const parent = "33333333-3333-4333-8333-333333333333";
    const p = liteTrackClickParams({
      query: { gclid: "G1", clickora_click_id: parent, var1: "a", clickid: "up" },
      headers: { cookie: "_fbp=fb.1.123.456; _ttp=TT1" },
    });
    assert.equal(p.get("gclid"), "G1");
    assert.equal(p.get("parent_click_id"), parent);
    assert.equal(p.get("var1"), "a");
    assert.equal(p.get("clickid"), "up");
    assert.equal(p.get("fbp"), "fb.1.123.456");
    assert.equal(p.get("ttp"), "TT1");
  });

  it("parent_click_id que não é UUID é ignorado", () => {
    const p = liteTrackClickParams({ query: { parent_click_id: "not-a-uuid" }, headers: {} });
    assert.equal(p.get("parent_click_id"), null);
  });
});

describe("liteOfferForwardParams", () => {
  it("sub1/sub2 por defeito + allowlist das settings (case-insensitive, sem `to`)", () => {
    assert.deepEqual(buildOfferForwardParamKeys({ offerQueryForwardAllowlist: "tid, TO aff_sub" }), [
      "sub1",
      "sub2",
      "tid",
      "aff_sub",
    ]);
    const p = liteOfferForwardParams(
      { query: { SUB1: "s1", tid: "T9", to: "https://evil.example", other: "x" } },
      { offerQueryForwardAllowlist: "tid" },
    );
    assert.equal(p.toString(), "sub1=s1&tid=T9");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICKORA_MIRROR_TRACK_MARKER,
  finalizeMirrorSrcDocForImport,
  mirrorUrlShouldUseTrackMarker,
  tryExtractUrlFromInlineHandler,
} from "./presellMirrorSnapshot";

describe("mirrorUrlShouldUseTrackMarker", () => {
  const hosts = new Set(["lander.example"]);

  it("buygoods checkout uses marker even when hoplink host differs", () => {
    assert.equal(
      mirrorUrlShouldUseTrackMarker(new URL("https://www.buygoods.com/secure/checkout.html?vid=tsl"), hosts),
      true,
    );
  });

  it("does not rewrite unrelated external articles", () => {
    assert.equal(mirrorUrlShouldUseTrackMarker(new URL("https://www.ncbi.nlm.nih.gov/books/"), hosts), false);
  });

  it("rewrites same host as import page / affiliate set", () => {
    assert.equal(
      mirrorUrlShouldUseTrackMarker(new URL("https://lander.example/other-page"), hosts),
      true,
    );
  });

  it("skips image assets", () => {
    assert.equal(
      mirrorUrlShouldUseTrackMarker(new URL("https://cdn.example.com/img/bottle.png"), hosts),
      false,
    );
  });
});

describe("tryExtractUrlFromInlineHandler", () => {
  it("quoted location.href", () => {
    assert.equal(
      tryExtractUrlFromInlineHandler(`void(location.href='https://hop.example/o?id=1')`),
      "https://hop.example/o?id=1",
    );
  });

  it("double-quoted window.location", () => {
    assert.equal(
      tryExtractUrlFromInlineHandler(`window.location = "https://offer.test/buy"`),
      "https://offer.test/buy",
    );
  });

  it("window.open", () => {
    assert.equal(tryExtractUrlFromInlineHandler(`window.open('https://x.example/y')`), "https://x.example/y");
  });

  it("location.assign", () => {
    assert.equal(tryExtractUrlFromInlineHandler(`location.assign("https://z.example")`), "https://z.example");
  });

  it("rejects javascript:", () => {
    assert.equal(tryExtractUrlFromInlineHandler(`location.href='javascript:void(0)'`), null);
  });

  it("empty or useless", () => {
    assert.equal(tryExtractUrlFromInlineHandler(""), null);
    assert.equal(tryExtractUrlFromInlineHandler("return false"), null);
  });
});

describe("finalizeMirrorSrcDocForImport (onclick → href)", () => {
  it("turns button with location.href onclick into track link", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<button type="button" class="cta" onclick="location.href='https://offer.example/buy?x=1'">Buy</button>
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://offer.example/land",
      "https://offer.example/buy?x=1",
    );
    assert.ok(out);
    assert.ok(out!.includes(CLICKORA_MIRROR_TRACK_MARKER));
    assert.ok(out!.includes(">Buy<") || out!.includes(">Buy</a>"));
    assert.ok(!out!.toLowerCase().includes("onclick"));
  });

  it("rewrites buygoods anchor when affiliate link is another domain", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
<a href="https://www.buygoods.com/secure/checkout.html?aff_id=190743&vid1=tsl">Buy Now</a>
</body></html>`;
    const out = finalizeMirrorSrcDocForImport(
      html,
      "https://vendorsite.example/presell",
      "https://my.rotator.example/track?id=1",
    );
    assert.ok(out);
    assert.ok(out!.includes(CLICKORA_MIRROR_TRACK_MARKER));
  });
});

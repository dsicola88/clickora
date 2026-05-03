import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICKORA_MIRROR_TRACK_MARKER,
  finalizeMirrorSrcDocForImport,
  tryExtractUrlFromInlineHandler,
} from "./presellMirrorSnapshot";

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
});

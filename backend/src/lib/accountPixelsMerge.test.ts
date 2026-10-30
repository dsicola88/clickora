import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeAccountPixelsIntoSettings } from "./accountPixelsMerge";

describe("mergeAccountPixelsIntoSettings", () => {
  it("injeta pixel da conta quando a página está vazia", () => {
    const s = mergeAccountPixelsIntoSettings({}, { metaPixelId: "1111222233334444", tiktokPixelId: "CABCDEF1234567890" });
    assert.equal(s.fbPixelId, "1111222233334444");
    assert.equal(s.tiktokPixelId, "CABCDEF1234567890");
  });

  it("não sobrescreve pixel da página", () => {
    const s = mergeAccountPixelsIntoSettings(
      { fbPixelId: "9999888877776666", tiktokPixelId: "PAGEPIXEL12" },
      { metaPixelId: "1111222233334444", tiktokPixelId: "CABCDEF1234567890" },
    );
    assert.equal(s.fbPixelId, "9999888877776666");
    assert.equal(s.tiktokPixelId, "PAGEPIXEL12");
  });
});

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { applyMirrorEphemeralEditMode } from "./mirrorEphemeralEdit";

describe("applyMirrorEphemeralEditMode", () => {
  it("marca parágrafos mas não links de compra", () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
<p>Editable paragraph</p>
<a href="https://x.com">Buy Now</a>
<span>Inside</span>
</body></html>`);
    applyMirrorEphemeralEditMode(dom.window.document);
    const p = dom.window.document.querySelector("p");
    const a = dom.window.document.querySelector("a");
    const span = dom.window.document.querySelector("span");
    expect(p?.getAttribute("contenteditable")).toBe("true");
    expect(span?.classList.contains("editable-element")).toBe(true);
    expect(a?.hasAttribute("contenteditable")).toBe(false);
  });
});

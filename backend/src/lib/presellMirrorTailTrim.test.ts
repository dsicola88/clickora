import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { describe, it } from "node:test";
import { injectMirrorTailHeightStyle, trimMirrorTrailingSpacerNodes } from "./presellMirrorTailTrim";

describe("presellMirrorTailTrim", () => {
  it("remove div min-height vazio no fim", () => {
    const root = parse(`<html><body><main><p>Buy now offer</p></main><div class="min-h-screen"></div></body></html>`);
    const body = root.querySelector("body");
    assert.ok(body);
    const n = trimMirrorTrailingSpacerNodes(body);
    assert.ok(n >= 1);
    assert.ok(!body.innerHTML.includes("min-h-screen"));
  });

  it("injeta estilo anti min-height", () => {
    const out = injectMirrorTailHeightStyle("<html><head></head><body></body></html>");
    assert.ok(out.includes('data-clickora="mirror-tail"'));
  });
});
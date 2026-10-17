import { describe, expect, it } from "vitest";
import { preserveNavHashCtaAppearance } from "./presellMirrorPreserveNav";

describe("preserveNavHashCtaAppearance", () => {
  it("devolve /track/ no header para #order-now", () => {
    const html = `<!doctype html><html><body><header><nav><a class="btn" href="https://site.example/api/track/r/id?to=x">Order Now</a></nav></header></body></html>`;
    const out = preserveNavHashCtaAppearance(html);
    expect(out).toContain('href="#order-now"');
    expect(out).not.toContain("track/r/id");
  });
});

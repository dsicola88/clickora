import { describe, expect, it } from "vitest";
import { preserveNavHashCtaAppearance } from "./presellMirrorPreserveNav";

describe("preserveNavHashCtaAppearance", () => {
  it("mantém /track/ no header Order Now com target=_top (não reverte para #order-now)", () => {
    const html = `<!doctype html><html><body><header><nav><a class="btn" href="https://site.example/api/track/r/id?to=x">Order Now</a></nav></header></body></html>`;
    const out = preserveNavHashCtaAppearance(html);
    expect(out).toContain("track/r/id");
    expect(out).toContain('target="_top"');
    expect(out).toContain('data-clickora-offer="1"');
    expect(out).not.toContain('href="#order-now"');
  });

  it("marca botão Order Now com imagem no top-nav Neotonics", () => {
    const html = `<!doctype html><html><body><section class="top-nav"><ul class="menu"><li><a href="https://site.example/api/track/r/id"><img class="order-now-button" src="o.png"></a></li></ul></section></body></html>`;
    const out = preserveNavHashCtaAppearance(html);
    expect(out).toContain("track/r/id");
    expect(out).toContain('target="_top"');
    expect(out).toContain("order-now-button");
  });
});

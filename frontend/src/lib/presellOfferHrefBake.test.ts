import { describe, expect, it } from "vitest";
import { CLICKORA_MIRROR_TRACK_MARKER } from "./presellMirrorMarkers";
import { bakeHtmlOfferHrefs, hrefLooksLikeOfferLink } from "./presellOfferHrefBake";

describe("bakeHtmlOfferHrefs", () => {
  it("substitui o marcador e links buygoods", () => {
    const html = `
      <a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy</a>
      <a href="https://www.buygoods.com/secure/checkout?item=1">BUY NOW</a>
      <a href="/privacy">Privacy</a>
    `;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/track/r/x", "https://offer.example/buy");
    expect(out).toContain('href="https://app.example/track/r/x"');
    expect(out).not.toContain("buygoods.com");
    expect(out).not.toContain(CLICKORA_MIRROR_TRACK_MARKER);
    expect(out).toContain('href="/privacy"');
    expect(out).toContain('data-clickora-offer="1"');
  });

  it("repare CTAs com href morto e texto de compra", () => {
    const html = `<a href="#">Get VISIVRA from official site</a><a href="#top">Keep reading</a>`;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/track/r/x");
    expect(out).toContain("Get VISIVRA from official site</a>");
    expect(out.match(/track\/r\/x/g)?.length).toBe(1);
    expect(out).toContain('href="#top"');
  });

  it("converte #order-now do menu para /track/ com target=_top (redirect nativo)", () => {
    const html = `<a class="btn" href="#order-now"><img class="order-now-button" src="x.png"></a><a href="#ingredients">Ingredients</a>`;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/track/r/x");
    expect(out).toContain('href="https://app.example/track/r/x"');
    expect(out).toContain('target="_top"');
    expect(out).toContain('data-clickora-offer="1"');
    expect(out).toContain("order-now-button");
    expect(out).toContain('href="#ingredients"');
    expect(out).not.toContain('href="#order-now"');
  });

  it("repare CTAs que apontam ao site do produto (não só buygoods)", () => {
    const html = `
      <a href="https://tryvisivra.com/shop">Go directly at VISIVRA Shop</a>
      <a class="elementor-button" href="https://tryvisivra.com/order">Order</a>
      <a href="/terms">Terms</a>
    `;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/track/r/abc");
    expect(out.match(/track\/r\/abc/g)?.length).toBe(2);
    expect(out).not.toContain("tryvisivra.com");
    expect(out).toContain('href="/terms"');
  });

  it("botão sem href e CTAs passam a levar o hoplink rastreado; logo da rede sai", () => {
    const html = `
      <a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy</a>
      <button class="btn">Order Now</button>
      <a href="https://visivra.today/contact">Contact</a>
      <a href="/privacy">Privacy</a>
      <a href="https://buygoods.com"><img alt="buygoods" src="https://cdn.buygoods.com/l.png"></a>
    `;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/track/r/x", "https://buygoods.com/x");
    expect(out.match(/track\/r\/x/g)?.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("Order Now");
    expect(out).toContain("https://visivra.today/contact");
    expect(out).toContain('href="/privacy"');
    expect(out).not.toContain("cdn.buygoods.com");
  });

  it("reconhece hosts comerciais", () => {
    expect(hrefLooksLikeOfferLink("https://buygoods.com/x")).toBe(true);
    expect(hrefLooksLikeOfferLink("https://cdn.example/a.png")).toBe(false);
    expect(hrefLooksLikeOfferLink("https://shop.example/privacy")).toBe(false);
  });
});

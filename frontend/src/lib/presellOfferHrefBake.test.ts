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
    expect(hrefLooksLikeOfferLink("https://go.monetizze.com.br/x")).toBe(true);
    expect(hrefLooksLikeOfferLink("https://ev.braip.com/x")).toBe(true);
    expect(hrefLooksLikeOfferLink("https://mwebkivo.com/1/2")).toBe(true);
    expect(hrefLooksLikeOfferLink("https://cdn.example/a.png")).toBe(false);
    expect(hrefLooksLikeOfferLink("https://shop.example/privacy")).toBe(false);
  });

  it("segunda passagem pega hoplink cru sem classe de botão", () => {
    const html = `<div><a data-track="x" href="https://mwebkivo.com/13026/4926/2/?">go</a></div>`;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/track/r/x", "https://mwebkivo.com/13026/4926/2/?");
    expect(out).toContain("https://app.example/track/r/x");
    expect(out).not.toContain("mwebkivo.com");
  });

  it("Get Started (button Funnelish) e Contact errado no marcador → track só nos CTAs", () => {
    const html = `
      <base href="https://tryvisivra.com/pv-v2?aff_id=1">
      <button class="anchor_to_product" data-eltype="button" id="cta1">
        <span data-button-text="true">Get Started with VISIVRA Today !</span>
      </button>
      <a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy now Starter</a>
      <a href="${CLICKORA_MIRROR_TRACK_MARKER}">Contact</a>
      <a href="${CLICKORA_MIRROR_TRACK_MARKER}">Privacy</a>
      <a href="https://www.buygoods.com/secure/checkout?item=1">BUY NOW!</a>
    `;
    const out = bakeHtmlOfferHrefs(html, "https://app.example/api/track/r/abc?to=mweb", "https://mwebkivo.com/1/");
    expect(out).toContain('<base href="./">');
    expect(out).not.toContain("tryvisivra.com/pv-v2");
    expect(out).not.toContain("<button");
    expect(out).toContain("Get Started with VISIVRA Today !");
    expect(out).toContain('data-clickora-offer="1"');
    expect(out).toContain('target="_top"');
    expect(out.match(/\/api\/track\/r\/abc/g)?.length).toBeGreaterThanOrEqual(3);
    expect(out).not.toContain("buygoods.com");
    // Soft-nav não abre oferta
    expect(out).toMatch(/href="#"[^>]*>Contact</);
    expect(out).toMatch(/href="#"[^>]*>Privacy</);
    expect(out).not.toMatch(/data-clickora-offer="1"[^>]*>Contact</);
  });

  describe("navegação nativa (sem JS no iframe)", () => {
    const TRACK =
      "https://app.example/api/track/r/abc?to=https%3A%2F%2Fhop.example%2F1&gclid=Cj0KCQ&utm_source=google&utm_campaign=c1";

    it("CTA vira <a href=track target=_top> preservando gclid e UTMs, sem onclick/javascript:", () => {
      const html = `<a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy now</a>
        <a href="https://www.buygoods.com/secure/checkout?item=1" onclick="return false">ORDER NOW</a>`;
      const out = bakeHtmlOfferHrefs(html, TRACK, "https://hop.example/1");
      const anchors = out.match(/<a\b[^>]*>/gi) ?? [];
      expect(anchors.length).toBe(2);
      for (const a of anchors) {
        expect(a).toContain(`href="${TRACK}"`);
        expect(a).toContain('target="_top"');
        expect(a).toMatch(/rel="noopener noreferrer"/);
      }
      expect(out).toContain("gclid=Cj0KCQ");
      expect(out).toContain("utm_source=google");
      expect(out).not.toMatch(/javascript:/i);
      expect(out).not.toMatch(/<script/i);
    });

    it("form de checkout aponta ao hop rastreado e submete no topo", () => {
      const html = `<form method="get" action="https://www.buygoods.com/secure/checkout"><input type="submit" value="Buy"></form>`;
      const out = bakeHtmlOfferHrefs(html, TRACK, "https://hop.example/1");
      expect(out).toMatch(/<form\b[^>]*action="[^"]*track\/r\/abc[^"]*"/);
      expect(out).toMatch(/<form\b[^>]*target="_top"/);
    });

    it("form não comercial fica intacto", () => {
      const html = `<form action="/subscribe"><input name="e"></form>`;
      expect(bakeHtmlOfferHrefs(html, TRACK)).toBe(html);
    });

    it("remove Unsubscribe / opt-out de mailer mas preserva checkout, termos, privacidade e suporte", () => {
      const html = `
        <a href="${CLICKORA_MIRROR_TRACK_MARKER}">buy now</a>
        <ul>
          <li><a href="https://visiflora.example/contact">Contact</a></li>
          <li><a href="https://visiflora.example/terms">Terms</a></li>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="https://visiflora.example/disclaimer">Disclaimer</a></li>
          <li><a href="https://support.zendesk.com/hc">Support</a></li>
          <li><a class="btn_primary w-100" href="https://www.redwindowrock.com/o-jlfr-j63-06c48ebf33160ccd043a8bbd3f74d911">Unsubscribe</a></li>
          <li><a href="https://mailer.example/unsubscribe?id=9">Manage Email Preferences</a></li>
        </ul>
      `;
      const out = bakeHtmlOfferHrefs(html, TRACK, "https://mwzenith.com/12271/11202/7/?");
      expect(out).not.toMatch(/redwindowrock\.com/i);
      expect(out).not.toMatch(/unsubscribe/i);
      expect(out).not.toMatch(/Manage Email Preferences/i);
      expect(out).not.toMatch(/<li\b[^>]*>\s*<\/li>/i);
      expect(out).toContain(`href="${TRACK}"`);
      expect(out).toContain("https://visiflora.example/contact");
      expect(out).toContain("https://visiflora.example/terms");
      expect(out).toContain('href="/privacy"');
      expect(out).toContain("https://visiflora.example/disclaimer");
      expect(out).toContain("https://support.zendesk.com/hc");
    });
  });
});

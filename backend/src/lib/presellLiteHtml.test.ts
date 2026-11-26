import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPresellLiteHtml, isPresellLiteHtmlEligible } from "./presellLiteHtml";

describe("presellLiteHtml", () => {
  it("bloqueia tipos com gate", () => {
    assert.equal(isPresellLiteHtmlEligible("cookies"), false);
    assert.equal(isPresellLiteHtmlEligible("builder"), false);
    assert.equal(isPresellLiteHtmlEligible("idade"), false);
  });

  it("permite review/tsl; bloqueia vsl/fantasma (SPA)", () => {
    assert.equal(isPresellLiteHtmlEligible("review"), true);
    assert.equal(isPresellLiteHtmlEligible("tsl"), true);
    assert.equal(isPresellLiteHtmlEligible("fantasma"), false);
    assert.equal(isPresellLiteHtmlEligible("vsl"), false);
  });

  it("gera HTML com CTA track e preload de imagem", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Produto X",
      type: "review",
      language: "pt",
      content: {
        affiliate_link: "https://offer.example/buy",
        product_image_url: "https://cdn.example/hero.jpg",
        article: {
          headline: "Como avaliar Produto X",
          intro: "Texto introdutório com mais de quarenta caracteres para o artigo.",
          cta_label: "Ver oferta",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.match(built.html, /<!DOCTYPE html>/i);
    assert.match(built.html, /https:\/\/go\.example\.com\/api\/track\/r\/11111111-1111-4111-8111-111111111111/);
    assert.match(built.html, /fetchpriority="high"/);
    assert.match(built.html, /preload/);
    assert.match(built.html, /Como avaliar Produto X/);
  });

  it("embute pixel 1×1 sem script quando impressionPixelUrl definido", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Produto X",
      type: "review",
      language: "pt",
      content: {
        affiliate_link: "https://offer.example/buy",
        article: {
          headline: "H",
          intro: "Texto introdutório longo " + "x".repeat(50),
          cta_label: "Ver oferta",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
      impressionPixelUrl:
        "https://go.example.com/api/track/pixel/11111111-1111-4111-8111-111111111111.gif?utm_source=ads",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.match(built.html, /track\/pixel\/11111111/);
    assert.doesNotMatch(built.html, /<script/i);
  });

  it("recusa sem oferta", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "X",
      type: "review",
      content: {},
      tracking: {},
      trackApiBase: "https://api.example/api",
    });
    assert.equal(built.ok, false);
  });

  it("usa importMirrorSrcDoc no HTML lite (white espelho)", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Visivra",
      type: "review",
      language: "en",
      content: {
        generationNiche: "white",
        affiliateLink: "https://offer.example/buy",
        importMirrorSrcDoc: `<!DOCTYPE html><html><body><h1>VISIVRA REVIEW PAGE</h1><a href="https://clickora.invalid/__TRACK_OFFER__">Get Started</a>${"x".repeat(250)}</body></html>`,
        article: {
          headline: "How to review the Tryvisivra offer with transparency",
          intro: "fallback editorial",
          cta_label: "Continue to the official offer page",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.match(built.html, /VISIVRA REVIEW PAGE/);
    assert.match(built.html, /class="mirror"/);
    assert.match(built.html, /go\.example\.com\/api\/track\/r\/11111111/);
  });

  it("essentials: HTML lite ignora espelho mesmo com importMirrorSrcDoc", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Visivra",
      type: "review",
      language: "en",
      content: {
        generationNiche: "white",
        importPresentation: "essentials",
        affiliateLink: "https://offer.example/buy",
        importMirrorSrcDoc: `<!DOCTYPE html><html><body><h1>SHOULD NOT EMBED</h1>${"x".repeat(250)}</body></html>`,
        article: {
          headline: "Independent review headline",
          intro: "Original intro " + "y".repeat(80),
          cta_label: "See packages",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.doesNotMatch(built.html, /SHOULD NOT EMBED/);
    assert.doesNotMatch(built.html, /class="mirror"/);
    assert.match(built.html, /Independent review headline/);

    const withPixel = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Produto X",
      type: "review",
      language: "pt",
      content: {
        affiliate_link: "https://offer.example/buy",
        article: {
          headline: "H",
          intro: "Texto introdutório longo " + "x".repeat(50),
          cta_label: "Ver oferta",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
      impressionPixelUrl: "https://go.example.com/api/track/pixel/11111111-1111-4111-8111-111111111111.gif?utm_source=ads",
    });
    assert.equal(withPixel.ok, true);
    if (withPixel.ok) {
      assert.match(withPixel.html, /track\/pixel\/11111111/);
      assert.doesNotMatch(withPixel.html, /<script/i);
    }
    assert.doesNotMatch(built.html, /How to review the Tryvisivra offer with transparency/);
  });

  it("lite remove scripts e on* do espelho antes de embutir (AdsBot)", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "T",
      type: "review",
      language: "pt",
      content: {
        generationNiche: "white",
        affiliateLink: "https://offer.example/buy",
        importMirrorSrcDoc: `<!DOCTYPE html><html><head><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example"/></head><body><script>window.bad=1</script><img src="x" onerror="alert(1)"><iframe src="https://unknown-tracker.example/x"></iframe><h1>Safe headline</h1>${"y".repeat(250)}</body></html>`,
        article: {
          headline: "H",
          intro: "intro longa " + "a".repeat(50),
          cta_label: "CTA",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.doesNotMatch(built.html, /<script/i);
    assert.doesNotMatch(built.html, /\son\w+\s*=/i);
    assert.doesNotMatch(built.html, /<base\b/i);
    assert.doesNotMatch(built.html, /http-equiv\s*=\s*["']?refresh/i);
    assert.doesNotMatch(built.html, /unknown-tracker\.example/);
    assert.match(built.html, /Safe headline/);
  });

  it("black niche nunca embute espelho no lite", () => {
    const built = buildPresellLiteHtml({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Portal",
      type: "review",
      content: {
        generationNiche: "black",
        affiliateLink: "https://offer.example/buy",
        importMirrorSrcDoc: `<!DOCTYPE html><html><body><h1>CLONE SALES</h1>${"x".repeat(250)}</body></html>`,
        article: {
          headline: "How to review the Portal offer with transparency",
          intro: "Independent informational content.",
          cta_label: "Continue",
        },
      },
      tracking: {},
      trackApiBase: "https://go.example.com/api",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.doesNotMatch(built.html, /CLONE SALES/);
    assert.match(built.html, /How to review the Portal offer with transparency/);
  });
});

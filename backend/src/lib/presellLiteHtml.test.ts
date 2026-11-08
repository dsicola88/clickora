import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPresellLiteHtml, isPresellLiteHtmlEligible } from "./presellLiteHtml";

describe("presellLiteHtml", () => {
  it("bloqueia tipos com gate", () => {
    assert.equal(isPresellLiteHtmlEligible("cookies"), false);
    assert.equal(isPresellLiteHtmlEligible("builder"), false);
    assert.equal(isPresellLiteHtmlEligible("idade"), false);
  });

  it("permite review/tsl/fantasma", () => {
    assert.equal(isPresellLiteHtmlEligible("review"), true);
    assert.equal(isPresellLiteHtmlEligible("tsl"), true);
    assert.equal(isPresellLiteHtmlEligible("fantasma"), true);
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
});

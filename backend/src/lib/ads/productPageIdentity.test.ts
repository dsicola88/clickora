import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveProductNameFromPageTitle,
  parsePageHeadIdentity,
  productAlignmentScore,
  resolveCampaignProductName,
} from "./productPageIdentity";

describe("productPageIdentity", () => {
  it("extrai nome do título e do h1", () => {
    const html = `<html><head><title>GlucoTrust Official Site | Buy Now</title></head><body><h1>GlucoTrust</h1></body></html>`;
    const head = parsePageHeadIdentity(html);
    assert.equal(head.pageTitle?.includes("GlucoTrust"), true);
    assert.equal(head.h1, "GlucoTrust");
    assert.equal(deriveProductNameFromPageTitle(head.pageTitle!), "GlucoTrust");
  });

  it("alinha nomes parecidos em auto", () => {
    const html = `<html><head><title>Kerassentials - Official</title></head><body><h1>Kerassentials Nail Formula</h1></body></html>`;
    const r = resolveCampaignProductName({ userProduct: "Kerassentials", html, productNameSource: "auto" });
    assert.ok(r.aligned);
    assert.match(r.effectiveProduct, /Kerassentials/i);
  });

  it("em auto substitui nome do formulário quando quase não coincide", () => {
    const html = `<html><head><title>ProvaDent Dental Formula</title></head><body><h1>ProvaDent</h1></body></html>`;
    const r = resolveCampaignProductName({ userProduct: "Visivra", html, productNameSource: "auto" });
    assert.equal(r.aligned, false);
    assert.match(r.effectiveProduct, /ProvaDent/i);
    assert.equal(r.source, "page");
  });

  it("score de alinhamento", () => {
    assert.ok(productAlignmentScore("Gluco Trust", "GlucoTrust Official") >= 0.8);
    assert.ok(productAlignmentScore("Foo", "Bar") < 0.3);
  });
});

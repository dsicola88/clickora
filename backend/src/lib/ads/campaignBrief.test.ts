import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeterministicBundle } from "./adBundle";
import { keywordsForFunnel, prepareCampaignInput } from "./campaignBrief";
import { extractProductPageFacts } from "./productPageFacts";
import type { KeywordItem } from "../keywordGenerator";

const PAGE = `
<html><head><title>Nordic Oak Lamp</title></head><body>
<h1>Nordic Oak Lamp</h1>
<p>The lamp costs $49 and ships in one payment.</p>
<p>60 day money-back guarantee if you return the lamp.</p>
<p>Save 10% off this week.</p>
<h2>Benefits</h2>
<ul><li>Solid oak base included</li><li>Warm LED light</li></ul>
<p>Ideal for small desks.</p>
<a href="/buy">Buy now</a>
</body></html>`;

describe("extractProductPageFacts", () => {
  it("confirma preço, garantia e desconto que estão escritos e não inventa o resto", () => {
    const facts = extractProductPageFacts(PAGE);
    assert.match(facts.priceNote ?? "", /^The lamp costs \$49 and ships in one payment\.?$/);
    assert.match(facts.guaranteeNote ?? "", /60 day money-back/i);
    assert.equal(facts.promotionPercent, "10");
    assert.equal(facts.facts.some((fact) => fact.label === "Bónus"), false);
    assert.ok(facts.missing.includes("Bónus"));
    assert.equal(facts.facts.filter((fact) => fact.status === "confirmed").every((fact) => PAGE.includes(fact.value.replace(/\s+/g, " ").slice(0, 12)) || fact.value.includes("%")), true);
  });
});

describe("extractProductPageFacts produto", () => {
  it("ignora a frase de outro produto e lê 77% mesmo sem a palavra off", () => {
    const html = `
      <p>Do I have a money-back guarantee if VISIVRA doesn't work for me? 180 day money-back guarantee.</p>
      <p>CelluCare costs $49 today.</p>
      <p>CelluCare includes a 180 day money-back guarantee.</p>
      <p>77%</p>
      <p>100% natural ingredients.</p>
      <img alt="CelluCare only £39">
    `;
    const facts = extractProductPageFacts(html, "CelluCare");
    assert.match(facts.priceNote ?? "", /CelluCare costs \$49/);
    assert.equal(/VISIVRA/i.test(facts.priceNote ?? ""), false);
    assert.equal(/VISIVRA/i.test(facts.guaranteeNote ?? ""), false);
    assert.match(facts.guaranteeNote ?? "", /180 day money-back/i);
    assert.equal(facts.promotionPercent, "77");
  });
});

describe("prepareCampaignInput", () => {
  it("usa só o texto colado quando a página não é consultada", async () => {
    const prepared = await prepareCampaignInput({
      product: "Nordic Oak Lamp",
      language: "en",
      affiliate_platform: "clickbank",
      product_url: "https://example.com/lamp",
      funnel: "BOTTOM",
      page_text: "The lamp costs $49. 60 day money-back guarantee on this lamp.",
    });
    assert.equal(prepared.analysis.pageStatus, "pasted");
    assert.equal(prepared.input.platform, "both");
    assert.equal(prepared.input.objective, "purchase");
    assert.equal(prepared.input.market, "US");
    assert.match(prepared.input.price_note ?? "", /\$49/);
  });

  it("não gera campanha quando o link não pode ser consultado", async () => {
    await assert.rejects(
      () =>
        prepareCampaignInput({
          product: "Nordic Oak Lamp",
          language: "en",
          affiliate_platform: "hotmart",
          product_url: "http://127.0.0.1/lamp",
          funnel: "TOP",
        }),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "PAGE_UNAVAILABLE",
    );
  });
});

describe("funil da campanha", () => {
  const items: KeywordItem[] = [
    { keyword: "buy lamp", intent: "BUY", relevance: "HIGH", negativeSuggestion: false, negativeGroup: null, funnel: "BOTTOM" },
    { keyword: "lamp review", intent: "COMMERCIAL", relevance: "MEDIUM", negativeSuggestion: false, negativeGroup: null, funnel: "MIDDLE" },
    { keyword: "what is lamp", intent: "INFORMATIONAL", relevance: "MEDIUM", negativeSuggestion: false, negativeGroup: null, funnel: "TOP" },
    { keyword: "lamp jobs", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true, negativeGroup: "JOBS", funnel: null },
  ];

  it("fundo de funil fica com compra, marca e negativas", () => {
    const kept = keywordsForFunnel(items, "BOTTOM").map((item) => item.intent);
    assert.deepEqual(kept, ["BUY", "NEGATIVE"]);
  });

  it("topo não abre com título de compra", () => {
    const bundle = buildDeterministicBundle(
      { product: "Nordic Lamp", language: "en", market: "US", platform: "both", objective: "commercial", funnel: "TOP" },
      items,
    );
    assert.equal(/^buy /i.test(bundle.headlines[0]?.text ?? ""), false);
    assert.equal(bundle.snippet, null);
    assert.equal(bundle.promotion, null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeterministicKeywords } from "../keywordGenerator";
import { adTextLength } from "./adText";
import { buildDeterministicBundle, type AdGenerateInput } from "./adBundle";
import { validateBundle } from "./adValidate";

const CASES: AdGenerateInput[] = [
  { product: "Nordic Lamp", language: "en", market: "US", platform: "google", objective: "purchase" },
  { product: "Notion", language: "en", market: "GB", platform: "microsoft", objective: "leads" },
  {
    product: "Serum de cilios",
    language: "pt",
    market: "BR",
    platform: "google",
    objective: "comparison",
    final_url: "https://example.com/serum",
    price_note: "R$ 97",
    offer_note: "frete incluso",
  },
  { product: "Kaffeevollautomat", language: "de", market: "DE", platform: "both", objective: "commercial" },
  { product: "Curso de Excel", language: "es", market: "MX", platform: "google", objective: "purchase" },
  { product: "Lampe de bureau", language: "fr", market: "FR", platform: "microsoft", objective: "comparison" },
  { product: "Xylophone kit", language: "it", market: "IT", platform: "google", objective: "commercial" },
];

describe("auditoria comercial do fallback", () => {
  for (const input of CASES) {
    it(`${input.product} / ${input.language}-${input.market} / ${input.platform} / ${input.objective}`, () => {
      const keywords = buildDeterministicKeywords(input.product, input.language);
      const bundle = buildDeterministicBundle(input, keywords);
      const notes = [input.price_note, input.offer_note, input.guarantee_note].filter(Boolean).join("\n");
      const issues = validateBundle(bundle, notes);
      assert.equal(bundle.source, "deterministic");
      assert.equal(bundle.llmFailed, false);
      assert.equal(bundle.snippet, null);
      assert.equal(bundle.promotion, null);
      assert.ok(bundle.headlines.length >= 3 && bundle.headlines.length <= 15);
      assert.ok(bundle.descriptions.length >= 2 && bundle.descriptions.length <= 4);
      assert.ok(bundle.headlines.every((h) => adTextLength(h.text) <= 30 && h.pin == null));
      assert.ok(bundle.descriptions.every((d) => adTextLength(d.text) <= 90));
      assert.equal(new Set(bundle.headlines.map((h) => h.text.toLowerCase())).size, bundle.headlines.length);
      const intents = new Set(keywords.map((k) => k.intent));
      for (const intent of ["BUY", "COMMERCIAL", "COMPARISON", "BRAND", "INFORMATIONAL", "NEGATIVE"]) {
        assert.equal(intents.has(intent as never), true, intent);
      }
      assert.equal(
        keywords.some((k) => /review|scam|complaint|reddit/i.test(k.keyword) && k.intent === "NEGATIVE"),
        false,
      );
      if (input.final_url) {
        assert.equal(bundle.sitelinks.length, 4);
        assert.ok(bundle.sitelinks.every((s) => s.url === input.final_url));
      } else {
        assert.ok(bundle.sitelinks.every((s) => s.url === ""));
      }
      if (input.price_note) assert.ok(bundle.callouts.some((c) => c.text === input.price_note));
      else assert.equal(bundle.callouts.length, 0);
      assert.equal(issues.some((i) => i.level === "invalid" && i.code === "length"), false);
      assert.ok(issues.some((i) => i.code === "fallback"));
    });
  }

  it("Microsoft rejeita caminho 2 sem caminho 1", () => {
    const keywords = buildDeterministicKeywords("Notion", "en");
    const bundle = buildDeterministicBundle(
      { product: "Notion", language: "en", market: "US", platform: "microsoft", objective: "purchase" },
      keywords,
    );
    bundle.path1 = "";
    bundle.path2 = "offer";
    const issues = validateBundle(bundle, "");
    assert.ok(issues.some((i) => i.code === "path_order" && i.level === "invalid"));
  });
});

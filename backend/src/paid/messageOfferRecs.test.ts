import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDeterministicMessageVariants,
  parseLlmMessageVariants,
} from "./messageOfferRecs";

describe("buildDeterministicMessageVariants", () => {
  it("gera variantes distintas sem inventar claims", () => {
    const out = buildDeterministicMessageVariants([
      {
        headline: "Kit Premium",
        body: "Veja o produto oficial na página",
        destination_url: "https://example.com/offer",
      },
      {
        headline: "Kit Premium",
        body: "Detalhes e condições no site oficial",
        destination_url: "https://example.com/offer",
      },
    ]);
    assert.ok(out.length >= 1);
    for (const v of out) {
      assert.equal(v.source, "deterministic");
      assert.ok(v.headline.length > 0);
      assert.ok(v.body.length > 0);
      assert.doesNotMatch(v.body, /\$\d+|%\s*off|garantia\s*\d+/i);
    }
  });

  it("sem seeds → vazio", () => {
    assert.equal(buildDeterministicMessageVariants([]).length, 0);
  });
});

describe("parseLlmMessageVariants", () => {
  it("aceita JSON válido e corta a 3", () => {
    const out = parseLlmMessageVariants({
      variants: [
        { headline: "A", body: "Um" },
        { headline: "B", body: "Dois" },
        { headline: "C", body: "Três" },
        { headline: "D", body: "Quatro" },
      ],
    });
    assert.equal(out.length, 3);
    assert.equal(out[0]!.source, "llm");
  });

  it("ignora payload inválido", () => {
    assert.equal(parseLlmMessageVariants(null).length, 0);
    assert.equal(parseLlmMessageVariants({ variants: "x" }).length, 0);
  });
});

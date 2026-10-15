import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultPresellTypeForNiche,
  isPresellTypeAllowedForNiche,
  normalizePresellGenerationNiche,
} from "./presellGenerationNiche";
import { extractPolicyUrlsFromHtml } from "./presellImporter";

describe("presellGenerationNiche", () => {
  it("normaliza para black por defeito", () => {
    assert.equal(normalizePresellGenerationNiche(undefined), "black");
    assert.equal(normalizePresellGenerationNiche("WHITE"), "white");
  });

  it("bloqueia fantasma no white", () => {
    assert.equal(isPresellTypeAllowedForNiche("fantasma", "white"), false);
    assert.equal(isPresellTypeAllowedForNiche("fantasma", "black"), true);
    assert.equal(isPresellTypeAllowedForNiche("tsl", "white"), true);
  });

  it("default de tipo por nicho", () => {
    assert.equal(defaultPresellTypeForNiche("black"), "cookies");
    assert.equal(defaultPresellTypeForNiche("white"), "tsl");
  });
});

describe("extractPolicyUrlsFromHtml", () => {
  it("extrai privacidade e termos", () => {
    const html = `
      <a href="/legal/privacy">Privacy Policy</a>
      <a href="https://shop.example/terms">Terms of Service</a>
    `;
    const out = extractPolicyUrlsFromHtml(html, "https://shop.example/sales");
    assert.equal(out.privacy, "https://shop.example/legal/privacy");
    assert.equal(out.terms, "https://shop.example/terms");
  });
});

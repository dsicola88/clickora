import { describe, expect, it } from "vitest";
import { fixtureBundle, fixtureKeywords } from "@/test/fixtures/keywordResearchFixture";
import { magazineCopyText } from "./magazineCopyText";
import { adTextLength } from "./adText";

describe("magazineCopyText", () => {
  it("segue ordem do PDF MAG", () => {
    const text = magazineCopyText("PV V2", fixtureBundle, fixtureKeywords);
    expect(text.indexOf("TÍTULOS:")).toBeLessThan(text.indexOf("DESCRIÇÕES:"));
    expect(text.indexOf("DESCRIÇÕES:")).toBeLessThan(text.indexOf("FRASE DE DESTAQUE:"));
    expect(text.indexOf("FRASE DE DESTAQUE:")).toBeLessThan(text.indexOf("SITELINK:"));
    expect(text).toContain("buy pv v2 online");
    expect(text).toContain("PV V2 Official Site");
  });

  it("títulos do fixture respeitam 30 caracteres", () => {
    for (const h of fixtureBundle.headlines) {
      expect(adTextLength(h.text)).toBeLessThanOrEqual(30);
    }
  });
});

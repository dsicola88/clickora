import { describe, expect, it } from "vitest";
import {
  defaultPresellLanguageForAdCountry,
  presellLanguageFromImport,
} from "./presellCampaignLanguage";

describe("defaultPresellLanguageForAdCountry", () => {
  it("mercados EN usam en", () => {
    expect(defaultPresellLanguageForAdCountry("US")).toBe("en");
    expect(defaultPresellLanguageForAdCountry("ca")).toBe("en");
    expect(defaultPresellLanguageForAdCountry("GB")).toBe("en");
  });

  it("BR e mercados LATAM/UE conhecidos", () => {
    expect(defaultPresellLanguageForAdCountry("BR")).toBe("pt-BR");
    expect(defaultPresellLanguageForAdCountry("PT")).toBe("pt-BR");
    expect(defaultPresellLanguageForAdCountry("DE")).toBe("de");
    expect(defaultPresellLanguageForAdCountry("ES")).toBe("es");
  });

  it("código desconhecido não força idioma", () => {
    expect(defaultPresellLanguageForAdCountry("JP")).toBeNull();
  });
});

describe("presellLanguageFromImport", () => {
  it("applies medium/high confidence detection", () => {
    expect(presellLanguageFromImport("pt-BR", "en", "high")).toBe("en");
    expect(presellLanguageFromImport("en", "pt-BR", "medium")).toBe("pt-BR");
    expect(presellLanguageFromImport("en", "en", "medium")).toBe("en");
  });

  it("keeps selection on low confidence", () => {
    expect(presellLanguageFromImport("en", "pt-BR", "low")).toBe("en");
  });
});
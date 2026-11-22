import { describe, expect, it } from "vitest";
import { defaultPresellLanguageForAdCountry } from "./presellCampaignLanguage";

describe("defaultPresellLanguageForAdCountry", () => {
  it("mercados EN usam en", () => {
    expect(defaultPresellLanguageForAdCountry("US")).toBe("en");
    expect(defaultPresellLanguageForAdCountry("ca")).toBe("en");
    expect(defaultPresellLanguageForAdCountry("GB")).toBe("en");
  });

  it("BR e mercados LATAM/UE conhecidos", () => {
    expect(defaultPresellLanguageForAdCountry("BR")).toBe("pt-BR");
    expect(defaultPresellLanguageForAdCountry("DE")).toBe("de");
    expect(defaultPresellLanguageForAdCountry("ES")).toBe("es");
  });

  it("código desconhecido não força idioma", () => {
    expect(defaultPresellLanguageForAdCountry("JP")).toBeNull();
  });
});
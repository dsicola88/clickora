import { describe, expect, it } from "vitest";
import { GOOGLE_ADS_COUNTRY_OPTIONS, GOOGLE_ADS_LANGUAGE_OPTIONS } from "./googleAdsTargeting";

/**
 * Espelho estático dos mapas backend (geo-google / language-google).
 * Se o backend adicionar um código, este teste falha até sincronizar o FE.
 */
const BACKEND_GEO_CODES = [
  "US",
  "CA",
  "GB",
  "AU",
  "BR",
  "DE",
  "FR",
  "IT",
  "ES",
  "PT",
  "NL",
  "BE",
  "CH",
  "AT",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "CZ",
  "IE",
  "GR",
  "TR",
  "IN",
  "JP",
  "MX",
  "AR",
  "AO",
  "CL",
  "CO",
  "NZ",
  "ZA",
  "SG",
  "MY",
  "TH",
  "PH",
  "ID",
  "VN",
  "RO",
] as const;

const BACKEND_LANG_CODES = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "ja",
  "nl",
  "pt",
  "pl",
  "sv",
  "da",
  "fi",
  "no",
  "cs",
  "el",
  "hu",
  "ro",
  "ru",
  "tr",
  "ko",
  "zh",
  "hi",
  "ar",
] as const;

describe("googleAdsTargeting parity with backend planner criteria", () => {
  it("países FE = geo-google (sem UK)", () => {
    const fe = new Set(GOOGLE_ADS_COUNTRY_OPTIONS.map((o) => o.code));
    const be = new Set(BACKEND_GEO_CODES);
    expect([...fe].sort()).toEqual([...be].sort());
  });

  it("idiomas FE = language-google", () => {
    const fe = new Set(GOOGLE_ADS_LANGUAGE_OPTIONS.map((o) => o.code));
    const be = new Set(BACKEND_LANG_CODES);
    expect([...fe].sort()).toEqual([...be].sort());
  });
});

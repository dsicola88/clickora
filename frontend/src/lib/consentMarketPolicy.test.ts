import { describe, expect, it } from "vitest";
import {
  readMarketCountryHint,
  resolveConsentMarketMode,
  resolveConsentRuntimePolicy,
} from "./consentMarketPolicy";

describe("consentMarketPolicy", () => {
  it("DE/BR/PT → strict; US/CA → flexible", () => {
    expect(resolveConsentMarketMode({ language: "de" })).toBe("strict");
    expect(resolveConsentMarketMode({ language: "pt-BR" })).toBe("strict");
    expect(resolveConsentMarketMode({ language: "pt" })).toBe("strict");
    expect(resolveConsentMarketMode({ language: "en", marketCountry: "US" })).toBe("flexible");
    expect(resolveConsentMarketMode({ language: "en", marketCountry: "CA" })).toBe("flexible");
    expect(resolveConsentMarketMode({ language: "en", marketCountry: "GB" })).toBe("strict");
  });

  it("cookies: sempre gate marketing + GCM denied", () => {
    const de = resolveConsentRuntimePolicy({ presellType: "cookies", language: "de" });
    expect(de.gateMarketingUntilAccept).toBe(true);
    expect(de.applyConsentModeDefaults).toBe(true);
    expect(de.consentModeDefaultDenied).toBe(true);

    const us = resolveConsentRuntimePolicy({
      presellType: "cookies",
      language: "en",
      marketCountry: "US",
    });
    expect(us.mode).toBe("flexible");
    expect(us.gateMarketingUntilAccept).toBe(true);
    expect(us.consentModeDefaultDenied).toBe(true);
  });

  it("review strict: inject livre mas GCM denied; US flex sem forçar GCM", () => {
    const de = resolveConsentRuntimePolicy({ presellType: "review", language: "de" });
    expect(de.gateMarketingUntilAccept).toBe(false);
    expect(de.applyConsentModeDefaults).toBe(true);
    expect(de.consentModeDefaultDenied).toBe(true);

    const us = resolveConsentRuntimePolicy({
      presellType: "review",
      language: "en",
      marketCountry: "US",
    });
    expect(us.gateMarketingUntilAccept).toBe(false);
    expect(us.applyConsentModeDefaults).toBe(false);
  });

  it("readMarketCountryHint lê settings", () => {
    expect(readMarketCountryHint({ marketCountry: "us" }, null)).toBe("US");
    expect(readMarketCountryHint({ ads_country: "de" }, null)).toBe("DE");
  });
});

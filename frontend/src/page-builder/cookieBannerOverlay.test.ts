import { describe, expect, it } from "vitest";
import { cookieBannerLocksPage, cookieBannerUsesPageOverlay } from "./cookieBannerOverlay";

describe("cookieBannerUsesPageOverlay", () => {
  it("nunca cobre o canvas do editor", () => {
    expect(
      cookieBannerUsesPageOverlay({ inBuilder: true, variant: "modal", dismissed: false }),
    ).toBe(false);
  });

  it("cobre o visitante na página publicada até aceitar", () => {
    expect(
      cookieBannerUsesPageOverlay({ inBuilder: false, variant: "modal", dismissed: false }),
    ).toBe(true);
    expect(
      cookieBannerUsesPageOverlay({ inBuilder: false, variant: "modal", dismissed: true }),
    ).toBe(false);
  });

  it("canto e barra também usam portal fixed no visitante", () => {
    expect(
      cookieBannerUsesPageOverlay({ inBuilder: false, variant: "corner", dismissed: false }),
    ).toBe(true);
    expect(
      cookieBannerUsesPageOverlay({ inBuilder: false, variant: "bar", dismissed: false }),
    ).toBe(true);
  });
});

describe("cookieBannerLocksPage", () => {
  it("só o modal com backdrop bloqueia o scroll", () => {
    expect(cookieBannerLocksPage({ variant: "modal", backdrop: true })).toBe(true);
    expect(cookieBannerLocksPage({ variant: "modal", backdrop: false })).toBe(false);
    expect(cookieBannerLocksPage({ variant: "corner", backdrop: true })).toBe(false);
    expect(cookieBannerLocksPage({ variant: "bar", backdrop: true })).toBe(false);
  });
});

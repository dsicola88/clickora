import { describe, expect, it } from "vitest";
import { cookieBannerUsesPageOverlay } from "./cookieBannerOverlay";

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

  it("canto flutuante não usa overlay de página", () => {
    expect(
      cookieBannerUsesPageOverlay({ inBuilder: false, variant: "corner", dismissed: false }),
    ).toBe(false);
  });
});

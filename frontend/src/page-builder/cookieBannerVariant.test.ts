import { describe, expect, it } from "vitest";
import {
  resolveCookieBannerPosition,
  resolveCookieVariant,
  shouldHonorCookieVariantOnPublic,
} from "./cookieBannerVariant";

describe("cookieBannerVariant", () => {
  it("live legado força barra e posição bottom", () => {
    expect(shouldHonorCookieVariantOnPublic({})).toBe(false);
    expect(
      resolveCookieVariant("modal", { inBuilder: false, honorEditorVariant: false }),
    ).toBe("bar");
    expect(
      resolveCookieBannerPosition({
        position: "top-right",
        variant: "bar",
        inBuilder: false,
        honorEditorVariant: false,
      }),
    ).toBe("bottom");
  });

  it("com useEditorVariantOnPublic respeita modal e posição", () => {
    expect(shouldHonorCookieVariantOnPublic({ useEditorVariantOnPublic: true })).toBe(true);
    expect(
      resolveCookieVariant("corner", { inBuilder: false, honorEditorVariant: true }),
    ).toBe("corner");
    expect(
      resolveCookieBannerPosition({
        position: "bottom-left",
        variant: "corner",
        inBuilder: false,
        honorEditorVariant: true,
      }),
    ).toBe("bottom-left");
  });

  it("editor mostra qualquer variante", () => {
    expect(resolveCookieVariant("modal", { inBuilder: true, honorEditorVariant: false })).toBe(
      "modal",
    );
  });
});
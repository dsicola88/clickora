import { describe, expect, it } from "vitest";
import {
  cookieConsentNavigation,
  isCookieRedirectToOfferEnabled,
} from "./PresellTypeControls";

describe("cookieConsentNavigation", () => {
  it("Allow usa o link rastreado (só quando o opt-in está activo no chamador)", () => {
    expect(cookieConsentNavigation("allow", "/track/r/1?gclid=abc&sub1=s", "https://offer.example")).toEqual({
      kind: "assign",
      url: "/track/r/1?gclid=abc&sub1=s",
    });
  });

  it("Fechar nunca navega — página e CTAs ficam acessíveis", () => {
    expect(cookieConsentNavigation("dismiss", "/track/r/1?gclid=abc", "https://offer.example")).toEqual({
      kind: "stay",
    });
  });

  it("sem destino o modal não navega", () => {
    expect(cookieConsentNavigation("dismiss", "#", "")).toEqual({ kind: "stay" });
    expect(cookieConsentNavigation("allow", "#", "")).toEqual({ kind: "stay" });
  });
});

describe("isCookieRedirectToOfferEnabled", () => {
  it("opt-in: só true / 1 / string / snake_case activam; por defeito desligado", () => {
    expect(isCookieRedirectToOfferEnabled(undefined)).toBe(false);
    expect(isCookieRedirectToOfferEnabled({})).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: false })).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: true })).toBe(true);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: "true" })).toBe(true);
    expect(isCookieRedirectToOfferEnabled({ cookie_redirect_to_offer: 1 })).toBe(true);
  });
});

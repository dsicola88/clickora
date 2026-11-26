import { describe, expect, it } from "vitest";
import {
  cookieConsentNavigation,
  isCookieRedirectToOfferEnabled,
} from "./PresellTypeControls";

describe("cookieConsentNavigation", () => {
  it("Aceitar nunca navega — só grava o consentimento", () => {
    expect(cookieConsentNavigation("allow", "/track/r/1?gclid=abc&sub1=s", "https://offer.example")).toEqual({
      kind: "stay",
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
  it("descontinuado: sempre false, mesmo em páginas antigas com a chave activa", () => {
    expect(isCookieRedirectToOfferEnabled(undefined)).toBe(false);
    expect(isCookieRedirectToOfferEnabled({})).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: false })).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: true })).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: "true" })).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookie_redirect_to_offer: 1 })).toBe(false);
  });
});

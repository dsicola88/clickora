import { describe, expect, it } from "vitest";
import {
  cookieConsentNavigation,
  isCookieRedirectToOfferEnabled,
} from "./PresellTypeControls";

describe("cookieConsentNavigation", () => {
  it("Allow usa o link rastreado sem apagar o histórico", () => {
    expect(cookieConsentNavigation("allow", "/track/r/1?gclid=abc&sub1=s", "https://offer.example")).toEqual({
      kind: "assign",
      url: "/track/r/1?gclid=abc&sub1=s",
    });
  });

  it("Fechar segue para a oferta rastreada quando há destino", () => {
    expect(cookieConsentNavigation("dismiss", "/track/r/1?gclid=abc", "https://offer.example")).toEqual({
      kind: "assign",
      url: "/track/r/1?gclid=abc",
    });
  });

  it("sem destino o modal não navega", () => {
    expect(cookieConsentNavigation("dismiss", "#", "")).toEqual({ kind: "stay" });
    expect(cookieConsentNavigation("allow", "#", "")).toEqual({ kind: "stay" });
  });
});

describe("isCookieRedirectToOfferEnabled", () => {
  it("só activo com cookieRedirectToOffer true", () => {
    expect(isCookieRedirectToOfferEnabled(undefined)).toBe(false);
    expect(isCookieRedirectToOfferEnabled({})).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: false })).toBe(false);
    expect(isCookieRedirectToOfferEnabled({ cookieRedirectToOffer: true })).toBe(true);
  });
});

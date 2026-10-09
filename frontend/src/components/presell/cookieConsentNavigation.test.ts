import { describe, expect, it } from "vitest";
import { cookieConsentNavigation } from "./PresellTypeControls";

describe("cookieConsentNavigation", () => {
  it("Allow usa o link rastreado sem apagar o histórico", () => {
    expect(cookieConsentNavigation("allow", "/track/r/1?gclid=abc&sub1=s", "https://offer.example")).toEqual({
      kind: "assign",
      url: "/track/r/1?gclid=abc&sub1=s",
    });
  });

  it("Close e o fundo ficam na presell", () => {
    expect(cookieConsentNavigation("dismiss", "/track/r/1")).toEqual({ kind: "stay" });
  });

  it("Allow sem destino não navega", () => {
    expect(cookieConsentNavigation("allow", "#", "")).toEqual({ kind: "stay" });
  });
});

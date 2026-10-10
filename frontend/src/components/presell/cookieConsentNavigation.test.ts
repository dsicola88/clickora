import { describe, expect, it } from "vitest";
import { cookieConsentNavigation } from "./PresellTypeControls";

describe("cookieConsentNavigation", () => {
  it("Allow usa o link rastreado sem apagar o histórico", () => {
    expect(cookieConsentNavigation("allow", "/track/r/1?gclid=abc&sub1=s", "https://offer.example")).toEqual({
      kind: "assign",
      url: "/track/r/1?gclid=abc&sub1=s",
    });
  });

  it("Fechar e o fundo seguem para a oferta rastreada", () => {
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

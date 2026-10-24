import { describe, expect, it } from "vitest";
import {
  clampCookieOverlayBlur,
  clampCookieOverlayOpacity,
  resolveCookieBannerCopy,
} from "./cookieBannerCopy";

describe("cookie banner language", () => {
  it("traduz o texto de stock para o idioma da página", () => {
    const copy = resolveCookieBannerCopy(
      {
        title: "We Value Your Privacy",
        body: "We use cookies to enhance your browsing experience and analyze site traffic. By clicking Accept All, you consent to our use of cookies. Learn more in our",
        allowLabel: "ACCEPT ALL",
        declineLabel: "Manage Preferences",
        policyLabel: "Cookie Policy",
      },
      "pt-BR",
    );
    expect(copy.followsLanguage).toBe(true);
    expect(copy.title).toBe("Política de cookies");
    expect(copy.allowLabel).toBe("Permitir");
    expect(copy.policyLabel).toBe("Política de cookies");
  });

  it("mantém texto próprio quando o título não é de stock", () => {
    const copy = resolveCookieBannerCopy({ title: "Aviso da marca", allowLabel: "OK" }, "en");
    expect(copy.followsLanguage).toBe(false);
    expect(copy.title).toBe("Aviso da marca");
    expect(copy.allowLabel).toBe("OK");
  });

  it("em espanhol o stock inglês não fica em português", () => {
    const copy = resolveCookieBannerCopy({ title: "We Value Your Privacy" }, "es");
    expect(copy.title).toBe("Valoramos tu privacidad");
    expect(copy.allowLabel).toBe("Aceptar todo");
  });

  it("followLanguage false grava o texto editado", () => {
    const copy = resolveCookieBannerCopy(
      {
        title: "Cookie Policy",
        allowLabel: "Sim",
        footerNote: "Nota da marca",
        followLanguage: false,
      },
      "pt-BR",
    );
    expect(copy.followsLanguage).toBe(false);
    expect(copy.title).toBe("Cookie Policy");
    expect(copy.allowLabel).toBe("Sim");
    expect(copy.footerNote).toBe("Nota da marca");
  });

  it("limita a escuridão e o blur do overlay", () => {
    expect(clampCookieOverlayOpacity(12)).toBe(12);
    expect(clampCookieOverlayOpacity(200)).toBe(70);
    expect(clampCookieOverlayBlur(-1)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { resolveCookieBannerCopy } from "./cookieBannerCopy";

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
    expect(copy.title).toBe("Valorizamos a sua privacidade");
    expect(copy.allowLabel).toBe("Aceitar tudo");
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
});

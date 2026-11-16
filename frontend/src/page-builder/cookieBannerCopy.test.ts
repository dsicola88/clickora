import { describe, expect, it } from "vitest";
import {
  clampCookieOverlayBlur,
  clampCookieOverlayOpacity,
  resolveCookieBannerCopy,
  sanitizeCookieCloseLabel,
  syncCookieBodyWithAllowLabel,
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
    expect(copy.title).toMatch(/privacidade/i);
    expect(copy.allowLabel).toBe("Aceitar");
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
    expect(copy.allowLabel).toBe("Aceptar");
    expect(copy.declineLabel).toBe("Cerrar");
  });

  it("alemão: texto e botões alinhados (sem falso «Einstellungen»)", () => {
    const copy = resolveCookieBannerCopy(
      {
        title: "Cookie Policy",
        followLanguage: true,
      },
      "de",
    );
    expect(copy.followsLanguage).toBe(true);
    expect(copy.title).toMatch(/Privatsphäre/i);
    expect(copy.allowLabel).toBe("Akzeptieren");
    expect(copy.declineLabel).toBe("Schließen");
    expect(copy.body).toMatch(/Akzeptieren/);
    expect(copy.body).not.toMatch(/Erlauben|Einstellungen verwalten/i);
    expect(copy.footerNote).not.toBe(copy.title);
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

  it("todos os idiomas: botão no texto, fechar honesto, rodapé útil", async () => {
    const { PRESHELL_LOCALE_KEYS } = await import("@/lib/presellUiStrings.types");
    const { getPresellUiStrings } = await import("@/lib/presellUiStrings");
    const fakePrefs =
      /manage prefer|einstellungen verwalten|gérer les préférences|gestisci preferenze|gestionar preferencias/i;
    for (const loc of PRESHELL_LOCALE_KEYS) {
      const ui = getPresellUiStrings(loc);
      expect(ui.cookieAllow.trim(), loc).not.toBe("");
      expect(ui.cookieClose.trim(), loc).not.toBe("");
      expect(ui.cookieBody.includes(ui.cookieAllow), `${loc} body↔allow`).toBe(true);
      expect(ui.cookieClose, loc).not.toMatch(fakePrefs);
      expect(ui.cookieFooter.trim(), loc).not.toBe(ui.cookieTitle.trim());
      expect(ui.cookieAccept, loc).toBe(ui.cookieAllow);
      const copy = resolveCookieBannerCopy({ followLanguage: true }, loc);
      expect(copy.allowLabel, loc).toBe(ui.cookieAllow);
      expect(copy.declineLabel, loc).toBe(ui.cookieClose);
    }
  });

  it("cura inconsistência Erlauben vs Akzeptieren em texto legado", () => {
    const healed = syncCookieBodyWithAllowLabel(
      "Mit „Erlauben“ stimmen Sie zu. Weitere Infos in unserer",
      "Akzeptieren",
    );
    expect(healed).toContain("„Akzeptieren“");
    expect(healed).not.toContain("Erlauben");
  });

  it("rejeita rótulo falso de definições no botão fechar", () => {
    expect(sanitizeCookieCloseLabel("Einstellungen verwalten", "Schließen")).toBe("Schließen");
    expect(sanitizeCookieCloseLabel("Gestionar preferencias", "Cerrar")).toBe("Cerrar");
    expect(sanitizeCookieCloseLabel("Schließen", "Schließen")).toBe("Schließen");
  });

  it("texto legado DE com followLanguage false fica alinhado ao botão", () => {
    const copy = resolveCookieBannerCopy(
      {
        title: "Custom brand notice",
        body: "Mit „Erlauben“ stimmen Sie der Verwendung von Cookies zu.",
        allowLabel: "Akzeptieren",
        declineLabel: "Einstellungen verwalten",
        followLanguage: false,
      },
      "de",
    );
    expect(copy.body).toContain("„Akzeptieren“");
    expect(copy.body).not.toContain("Erlauben");
    expect(copy.declineLabel).toBe("Schließen");
  });
});

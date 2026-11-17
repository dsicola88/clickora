import { describe, expect, it, beforeEach } from "vitest";
import {
  clearCookieConsentChoice,
  cookieConsentChoiceKey,
  isMarketingConsentGranted,
  readCookieConsentChoice,
  writeCookieConsentChoice,
} from "./cookieConsentStorage";

describe("cookieConsentStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("grava Aceitar como all e Fechar como essential", () => {
    writeCookieConsentChoice("clickora-cookie-banner", "all");
    expect(readCookieConsentChoice()).toBe("all");
    expect(window.localStorage.getItem("clickora-cookie-banner")).toBe("1");
    expect(window.localStorage.getItem(cookieConsentChoiceKey("clickora-cookie-banner"))).toBe(
      "all",
    );
    expect(isMarketingConsentGranted(readCookieConsentChoice())).toBe(true);

    writeCookieConsentChoice("clickora-cookie-banner", "essential");
    expect(readCookieConsentChoice()).toBe("essential");
    expect(isMarketingConsentGranted(readCookieConsentChoice())).toBe(false);
  });

  it("legado só dismissed conta como essential", () => {
    window.localStorage.setItem("clickora-cookie-banner", "1");
    expect(readCookieConsentChoice()).toBe("essential");
  });

  it("clear retira escolha e dispara evento para reopen", () => {
    writeCookieConsentChoice("clickora-cookie-banner", "all");
    let seen: unknown = "unset";
    const onEvt = (e: Event) => {
      seen = (e as CustomEvent).detail?.choice;
    };
    window.addEventListener("clickora-cookie-consent", onEvt);
    clearCookieConsentChoice();
    window.removeEventListener("clickora-cookie-consent", onEvt);
    expect(readCookieConsentChoice()).toBeNull();
    expect(window.localStorage.getItem("clickora-cookie-banner")).toBeNull();
    expect(seen).toBeNull();
  });
});

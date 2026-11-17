import { describe, expect, it, beforeEach } from "vitest";
import {
  cookieConsentChoiceKey,
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

    writeCookieConsentChoice("clickora-cookie-banner", "essential");
    expect(readCookieConsentChoice()).toBe("essential");
  });

  it("legado só dismissed conta como essential", () => {
    window.localStorage.setItem("clickora-cookie-banner", "1");
    expect(readCookieConsentChoice()).toBe("essential");
  });
});

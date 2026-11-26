import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentModal } from "./PresellTypeControls";
import {
  PRESELL_COOKIE_STYLE_ORDER,
  getPresellCookieStyle,
} from "@/lib/presellCookieBannerStyles";

beforeEach(() => {
  window.localStorage.clear();
  document.body.style.removeProperty("padding-bottom");
  document.documentElement.style.removeProperty("scroll-padding-bottom");
});
afterEach(() => {
  cleanup();
  document.body.style.removeProperty("padding-bottom");
  document.documentElement.style.removeProperty("scroll-padding-bottom");
});

describe("CookieConsentModal — predefinições", () => {
  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: renderiza banner não bloqueante com Aceitar/Fechar iguais", (id) => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CookieConsentModal
        language="en"
        policyUrl=""
        accepted={false}
        onAccept={onAccept}
        onDismiss={onDismiss}
        styleId={id}
      />,
    );
    const sheet = screen.getByTestId("presell-cookie-sheet");
    expect(sheet.getAttribute("data-cookie-style")).toBe(id);
    expect(sheet.getAttribute("data-cookie-layout")).toBe(getPresellCookieStyle(id).layout);
    expect(sheet.getAttribute("aria-modal")).toBe("false");
    // Sem backdrop/overlay que bloqueie a página; o wrapper deixa passar cliques.
    expect(sheet.className).toContain("pointer-events-none");
    expect(document.querySelector("[data-testid='presell-cookie-backdrop']")).toBeNull();
    expect(document.body.style.overflow).toBe("");

    const allow = screen.getByTestId("presell-cookie-allow");
    const close = screen.getByTestId("presell-cookie-close");
    // Equal prominence: mesmas classes estruturais (tamanho, peso, borda) — só a cor muda.
    const structural = (el: HTMLElement) =>
      el.className
        .split(/\s+/)
        .filter((c) => !c.includes("--ck-"))
        .sort()
        .join(" ");
    expect(structural(allow)).toBe(structural(close));
    expect(allow.className).toContain("var(--ck-allow-bg)");
    expect(close.className).toContain("var(--ck-close-bg)");

    fireEvent.click(allow);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("clickora-cookie-banner:choice")).toBe("all");
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: Fechar grava só essenciais e nunca navega", (id) => {
    const onDismiss = vi.fn();
    const assign = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, "location", { value: { ...orig, assign, search: "" }, writable: true });
    render(
      <CookieConsentModal
        language="en"
        policyUrl=""
        accepted={false}
        onDismiss={onDismiss}
        navigateOnAccept
        redirectHref="/track/r/abc"
        styleId={id}
      />,
    );
    fireEvent.click(screen.getByTestId("presell-cookie-close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("clickora-cookie-banner:choice")).toBe("essential");
    Object.defineProperty(window, "location", { value: orig, writable: true });
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: opt-in mantém Aceitar como link para /track/r/", (id) => {
    render(
      <CookieConsentModal
        language="en"
        policyUrl=""
        accepted={false}
        navigateOnAccept
        redirectHref="/track/r/abc"
        styleId={id}
      />,
    );
    const link = screen.getByTestId("presell-cookie-allow-offer");
    expect(link.getAttribute("href")).toBe("/track/r/abc");
    expect(link.tagName).toBe("A");
  });

  it("estilo inválido/ausente usa classicBar", () => {
    const { rerender } = render(<CookieConsentModal language="en" policyUrl="" accepted={false} />);
    expect(screen.getByTestId("presell-cookie-sheet").getAttribute("data-cookie-style")).toBe("classicBar");
    rerender(<CookieConsentModal language="en" policyUrl="" accepted={false} styleId="nope" />);
    expect(screen.getByTestId("presell-cookie-sheet").getAttribute("data-cookie-style")).toBe("classicBar");
  });

  it("reserva espaço no body enquanto aberto e restaura ao aceitar", () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: window.innerWidth, height: 120, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) });
    document.body.style.setProperty("padding-bottom", "7px");
    const { rerender } = render(<CookieConsentModal language="en" policyUrl="" accepted={false} styleId="darkBar" />);
    expect(document.body.style.paddingBottom).toBe("120px");
    expect(document.documentElement.style.scrollPaddingBottom).toBe("120px");
    rerender(<CookieConsentModal language="en" policyUrl="" accepted styleId="darkBar" />);
    expect(document.body.style.paddingBottom).toBe("7px");
    expect(document.documentElement.style.scrollPaddingBottom).toBe("");
    rect.mockRestore();
  });

  it("cartão no canto em desktop não reserva espaço", () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 384, height: 220, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) });
    render(<CookieConsentModal language="en" policyUrl="" accepted={false} styleId="cornerCard" />);
    expect(document.body.style.paddingBottom).toBe("");
    rect.mockRestore();
  });
});

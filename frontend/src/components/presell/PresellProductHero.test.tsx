import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscountPresellOverlay } from "./DiscountPresellOverlay";
import { CookieConsentModal } from "./PresellTypeControls";
import { PresellProductHero } from "./PresellProductHero";

describe("PresellProductHero", () => {
  it("reserva um palco alto e pede primeiro o rendition maior", () => {
    render(
      <PresellProductHero
        src="https://cdn.example/products/pack_320x320.jpg"
        alt="Pack do produto"
      />,
    );
    const stage = document.querySelector("[data-presell-hero='product']");
    expect(stage).toBeTruthy();
    expect(stage?.className).toContain("min-h-[min(58vh,640px)]");
    const img = screen.getByRole("img", { name: "Pack do produto" });
    expect(img.getAttribute("src")).toBe("https://cdn.example/products/pack_1400x.jpg");
    expect(img.className).toContain("object-contain");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("volta ao URL original e, se esse também falhar, não inventa uma foto", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <PresellProductHero
        src="https://cdn.example/products/pack_320x320.jpg"
        alt="Pack do produto"
        onError={onError}
      />,
    );
    const img = () => screen.getByRole("img", { name: "Pack do produto" });
    fireEvent.error(img());
    expect(img().getAttribute("src")).toBe("https://cdn.example/products/pack_320x320.jpg");
    fireEvent.error(img());
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Pack do produto")).toBeTruthy();
    expect(document.querySelector("[data-presell-hero='unavailable']")).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("mantém a imagem de apoio mais baixa quando o vídeo é o foco", () => {
    render(<PresellProductHero src="https://cdn.example/still.jpg" alt="Apoio" emphasis="support" />);
    const stage = document.querySelector("[data-presell-hero='product']");
    expect(stage?.getAttribute("data-presell-hero-emphasis")).toBe("support");
    expect(stage?.className).toContain("min-h-[min(36vh,380px)]");
  });
});

describe("CookieConsentModal", () => {
  it("mostra barra inferior compacta sem bloquear a página", () => {
    render(
      <CookieConsentModal
        language="en"
        policyUrl=""
        redirectHref=""
        accepted={false}
        onAccept={() => {}}
      />,
    );
    const sheet = screen.getByTestId("presell-cookie-sheet");
    expect(sheet.className).toContain("pointer-events-none");
    expect(sheet.className).toContain("inset-x-0");
    expect(sheet.getAttribute("aria-modal")).toBe("false");
    expect(screen.queryByTestId("presell-cookie-backdrop")).toBeNull();
    expect(screen.getByTestId("presell-cookie-card").className).toContain("pointer-events-auto");
    expect(screen.getByRole("heading", { name: /privacy matters/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByTestId("presell-cookie-policy-open")).toBeTruthy();
  });

  it("navigateOnAccept legado é ignorado: Aceitar é botão e nunca navega", () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CookieConsentModal
        language="en"
        policyUrl="/aviso-cookies"
        redirectHref="/track/r/abc?to=https%3A%2F%2Foffer.example"
        accepted={false}
        navigateOnAccept
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.queryByTestId("presell-cookie-allow-offer")).toBeNull();
    const allow = screen.getByTestId("presell-cookie-allow");
    expect(allow.tagName).toBe("BUTTON");
    expect(allow.getAttribute("href")).toBeNull();
    fireEvent.click(allow);
    expect(onAccept).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("sem redirect: Aceitar e Fechar só registam consentimento", () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CookieConsentModal
        language="en"
        policyUrl="/aviso-cookies"
        redirectHref="/track/r/abc?to=https%3A%2F%2Foffer.example"
        accepted={false}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.queryByTestId("presell-cookie-allow-offer")).toBeNull();
    fireEvent.click(screen.getByTestId("presell-cookie-allow"));
    expect(onAccept).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("presell-cookie-close"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("Fechar desbloqueia sem ir à oferta", () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CookieConsentModal
        language="en"
        policyUrl="/aviso-cookies"
        redirectHref="/track/r/abc?to=https%3A%2F%2Foffer.example"
        accepted={false}
        navigateOnAccept
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByTestId("presell-cookie-close"));
    expect(onDismiss).toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("política abre in-page sem sair da presell", () => {
    render(
      <CookieConsentModal
        language="de"
        policyUrl="/aviso-cookies?lang=de"
        accepted={false}
        onAccept={() => {}}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("presell-cookie-policy-open"));
    expect(screen.getByTestId("cookie-policy-inline-sheet")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Cookie-Hinweis/i })).toBeTruthy();
  });
});

describe("DiscountPresellOverlay", () => {
  it("deixa o produto visível e ancora a oferta em baixo", () => {
    render(
      <DiscountPresellOverlay
        language="en"
        headline="Offer"
        socialProof="Noted on the page"
        ratingValue="4.9"
        ratingStars={5}
        initialTimerSeconds={30}
        ctaText="Order Now"
        href="https://offer.example/buy"
      >
        <div data-testid="product-stage">Produto</div>
      </DiscountPresellOverlay>,
    );
    expect(screen.getByTestId("product-stage")).toBeTruthy();
    const sheet = screen.getByTestId("presell-discount-sheet");
    expect(sheet.className).toContain("items-end");
    expect(sheet.className).not.toContain("backdrop-blur");
    expect(screen.getByTestId("presell-discount-backdrop").getAttribute("aria-label")).toBe("Close");
    expect(screen.queryByLabelText("Continuar para a oferta")).toBeNull();
  });

  it("X e fundo só fecham o overlay; nunca navegam para a oferta", () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign, href: original.href, search: "" },
    });
    try {
      render(
        <DiscountPresellOverlay
          language="en"
          headline="Offer"
          socialProof=""
          ratingValue=""
          ratingStars={5}
          initialTimerSeconds={30}
          ctaText="Order Now"
          href="https://offer.example/buy"
        >
          <div>Produto</div>
        </DiscountPresellOverlay>,
      );
      fireEvent.click(screen.getByTestId("presell-discount-close"));
      expect(screen.queryByTestId("presell-discount-sheet")).toBeNull();
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("clicar no fundo fecha o overlay sem navegar", () => {
    render(
      <DiscountPresellOverlay
        language="en"
        headline="Offer"
        socialProof=""
        ratingValue=""
        ratingStars={5}
        initialTimerSeconds={0}
        ctaText="Order Now"
        href="https://offer.example/buy"
      >
        <div>Produto</div>
      </DiscountPresellOverlay>,
    );
    fireEvent.click(screen.getByTestId("presell-discount-backdrop"));
    expect(screen.queryByTestId("presell-discount-sheet")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

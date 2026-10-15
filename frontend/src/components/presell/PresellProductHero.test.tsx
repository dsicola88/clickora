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
  it("centra o cartão e bloqueia a página; só os botões aceitam", () => {
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
    expect(sheet.className).toContain("items-center");
    expect(screen.getByTestId("presell-cookie-card")).toBeTruthy();
    expect(screen.getByTestId("presell-cookie-backdrop").tagName).toBe("DIV");
    expect(screen.getByRole("heading", { name: "Cookie Policy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Allow" })).toBeTruthy();
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
  });
});

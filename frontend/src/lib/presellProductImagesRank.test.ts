import { describe, expect, it } from "vitest";
import { isPresellDecorImage, rankPresellProductImages } from "./presellProductImagesRank";
import { presellHeadline } from "./presellDisplayName";

describe("imagens da presell", () => {
  it("tira cartões, selos e a imagem social vazia e deixa a foto do produto", () => {
    const ranked = rankPresellProductImages([
      "https://jellylean.com/assets/main/products/img/cards.webp?",
      "https://tryvisivra.com/assets/social-default.png",
      "https://cdn.example.com/visivra-bottle.png",
      "https://jellylean.com/assets/main/guarantee/img/money-back-guarantee.svg?",
      "https://cdn.buygoods.com/assets/images/buygoods-logo-white.svg",
    ]);
    expect(ranked).toEqual(["https://cdn.example.com/visivra-bottle.png"]);
    expect(isPresellDecorImage("https://cdn.example.com/visa-mastercard.png")).toBe(true);
    expect(isPresellDecorImage("https://cdn.example.com/assets/payment-badges-1200x180.webp")).toBe(true);
  });
});

describe("nome em destaque", () => {
  it("troca o código da página pelo nome da presell", () => {
    expect(
      presellHeadline({
        importedClone: true,
        productName: "PV V2",
        contentTitle: "PV V2",
        pageTitle: "Visivra2",
      }),
    ).toBe("Visivra");
  });
});

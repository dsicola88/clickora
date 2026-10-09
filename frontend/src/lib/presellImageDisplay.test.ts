import { describe, expect, it } from "vitest";
import { presellImageDisplayCandidates, upgradePresellImageDisplayUrl } from "./presellImageDisplay";

describe("upgradePresellImageDisplayUrl", () => {
  it("sobe um recorte Shopify pequeno para 1400px", () => {
    expect(upgradePresellImageDisplayUrl("https://cdn.example/products/pack_300x300.jpg")).toBe(
      "https://cdn.example/products/pack_1400x.jpg",
    );
  });

  it("não altera um ficheiro que já é grande", () => {
    const url = "https://cdn.example/products/pack_1600x1600.jpg";
    expect(upgradePresellImageDisplayUrl(url)).toBe(url);
  });

  it("remove o sufixo pequeno do WordPress", () => {
    expect(upgradePresellImageDisplayUrl("https://shop.example/wp-content/uploads/pack-300x200.jpg")).toBe(
      "https://shop.example/wp-content/uploads/pack.jpg",
    );
  });

  it("sobe o parâmetro width quando é um thumbnail", () => {
    expect(upgradePresellImageDisplayUrl("https://img.example/p.jpg?width=240&q=80")).toBe(
      "https://img.example/p.jpg?width=1400&q=80",
    );
  });

  it("não inventa outro ficheiro para um URL sem token de tamanho", () => {
    const url = "https://cdn.example/hero/product.png";
    expect(upgradePresellImageDisplayUrl(url)).toBe(url);
    expect(presellImageDisplayCandidates(url)).toEqual([url]);
  });

  it("tenta o rendition maior e depois o URL original", () => {
    const raw = "https://cdn.example/a_200x200.webp";
    expect(presellImageDisplayCandidates(raw)).toEqual([
      "https://cdn.example/a_1400x.webp",
      raw,
    ]);
  });
});

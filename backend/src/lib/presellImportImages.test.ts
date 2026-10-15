import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFaviconUrlFromHtml, orderImportedProductImages } from "./presellImporter";

describe("orderImportedProductImages", () => {
  it("prefere a imagem larga do srcset à og:image sem tamanho", () => {
    const ordered = orderImportedProductImages([
      { url: "https://cdn.example/share/og-face.jpg", width: 0 },
      { url: "https://cdn.example/files/photo.jpg", width: 1400 },
    ]);
    assert.equal(ordered[0], "https://cdn.example/files/photo.jpg");
  });

  it("afasta miniaturas declaradas como pequenas", () => {
    const ordered = orderImportedProductImages([
      { url: "https://cdn.example/avatar.jpg", width: 64 },
      { url: "https://cdn.example/files/bottle.jpg", width: 960 },
    ]);
    assert.equal(ordered[0], "https://cdn.example/files/bottle.jpg");
  });

  it("não inventa um URL que não foi passado", () => {
    const only = "https://cdn.example/only.png";
    assert.deepEqual(orderImportedProductImages([{ url: only, width: 0 }]), [only]);
  });
});

describe("extractFaviconUrlFromHtml", () => {
  it("prefere apple-touch PNG ao .ico", () => {
    const html = `
      <link rel="icon" href="/favicon.ico">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    `;
    assert.equal(
      extractFaviconUrlFromHtml(html, "https://visivra.net/"),
      "https://visivra.net/apple-touch-icon.png",
    );
  });

  it("resolve href relativo com <base>", () => {
    const html = `<base href="https://cdn.visivra.net/assets/"><link rel="icon" type="image/png" href="brand.png">`;
    assert.equal(
      extractFaviconUrlFromHtml(html, "https://visivra.net/"),
      "https://cdn.visivra.net/assets/brand.png",
    );
  });
});

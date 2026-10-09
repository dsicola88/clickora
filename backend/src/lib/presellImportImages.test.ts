import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderImportedProductImages } from "./presellImporter";

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

import { describe, expect, it } from "vitest";
import { buildEditablePageDocument } from "./presellVisualEdit";
import {
  documentTextBlob,
  generatedCopyLeaksStockProduct,
  STOCK_CATALOG_PRODUCT_RE,
} from "./presellGenerationFidelity";
import { CLICKORA_MIRROR_TRACK_MARKER } from "./presellMirrorMarkers";

const FOREIGN_MIRROR = `<!doctype html><html><body>
<h1>Aurora Kettle</h1>
<p>Electric kettle with keep-warm. Confirm price on checkout.</p>
<a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy now</a>
</body></html>`;

describe("gerador adapta-se ao produto da URL — sem catálogo fixo", () => {
  it("reconhece copy de catálogo Visivra/Neotonics", () => {
    expect(STOCK_CATALOG_PRODUCT_RE.test("Why Choose Visivra?")).toBe(true);
    expect(STOCK_CATALOG_PRODUCT_RE.test("Aurora Kettle keep-warm")).toBe(false);
  });

  it("white: o documento gerado só fala do produto importado", () => {
    const doc = buildEditablePageDocument({
      title: "Campanha Aurora",
      type: "review",
      language: "en",
      content: {
        title: "Aurora Kettle",
        productName: "Aurora Kettle",
        ctaText: "Buy now",
        affiliateLink: "https://offer.example/aurora",
        productImages: ["https://cdn.example/aurora.jpg"],
        generationNiche: "white",
        importMirrorSrcDoc: FOREIGN_MIRROR,
        sourcePageTitle: "Aurora Kettle | Official Site",
      },
    });
    const blob = documentTextBlob(doc);
    expect(blob).toContain("Aurora Kettle");
    expect(generatedCopyLeaksStockProduct(blob, FOREIGN_MIRROR + "Aurora Kettle")).toBe(false);
    expect(blob.toLowerCase()).not.toMatch(/visivra|neotonics|yusleep|stopwatt|nitric boost/);
  });

  it("black: artigo usa o nome real; não cola Visivra nem claims de visão", () => {
    const doc = buildEditablePageDocument({
      title: "Campanha Aurora",
      type: "cookies",
      language: "pt-BR",
      content: {
        title: "Aurora Kettle",
        productName: "Aurora Kettle",
        salesText: "Cura milagrosa da visão",
        affiliateLink: "https://offer.example/aurora",
        productImages: ["https://cdn.example/aurora.jpg"],
        generationNiche: "black",
      },
    });
    const blob = documentTextBlob(doc);
    expect(blob).toContain("Aurora Kettle");
    expect(blob.toLowerCase()).not.toMatch(/visivra|neotonics|mácula|luz azul|visão nítida/);
    expect(generatedCopyLeaksStockProduct(blob, "Aurora Kettle")).toBe(false);
  });
});

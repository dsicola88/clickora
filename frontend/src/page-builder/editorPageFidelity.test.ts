import { describe, expect, it } from "vitest";
import { buildEditablePageDocument } from "@/lib/presellVisualEdit";
import { CLICKORA_MIRROR_TRACK_MARKER } from "@/lib/presellMirrorMarkers";
import {
  documentTextBlob,
  generatedCopyLeaksStockProduct,
} from "@/lib/presellGenerationFidelity";
import { identityFromPresellContent, documentHasImportedFold } from "./pageIdentity";
import { SECTION_BLOCKS, buildDtcFromScratch, buildSectionsFromRecipe } from "./section-blocks";

const FOREIGN_MIRROR = `<!doctype html><html><body>
<h1>Aurora Kettle</h1>
<p>Electric kettle with keep-warm. Confirm price on checkout.</p>
<a href="${CLICKORA_MIRROR_TRACK_MARKER}">Buy now</a>
</body></html>`;

describe("editor manual — fidelidade à página em edição", () => {
  it("blocos DTC com identidade Aurora não colam Visivra nem claims de visão", () => {
    const identity = {
      productName: "Aurora Kettle",
      headline: "Aurora Kettle | Official Site",
      heroImage: "https://cdn.example/aurora.jpg",
      offerHref: "https://offer.example/aurora",
      ctaLabel: "Buy now",
    };
    const blob = documentTextBlob({ sections: buildSectionsFromRecipe(undefined, identity) });
    expect(blob).toContain("Aurora Kettle");
    expect(blob).toContain("https://offer.example/aurora");
    expect(blob.toLowerCase()).not.toMatch(/visivra|neotonics|yusleep|stopwatt|lutein|retinal|ocular support/);
    expect(generatedCopyLeaksStockProduct(blob, "Aurora Kettle")).toBe(false);
  });

  it("página importada no editor não é marcada como vazia; receita genérica sem ctx não é Visivra", () => {
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
    expect(documentHasImportedFold(doc)).toBe(true);
    const identity = identityFromPresellContent(
      {
        productName: "Aurora Kettle",
        affiliateLink: "https://offer.example/aurora",
        productImages: ["https://cdn.example/aurora.jpg"],
      },
      doc,
      "Campanha Aurora",
    );
    expect(identity.productName).toBe("Aurora Kettle");
    const extra = SECTION_BLOCKS.find((b) => b.id === "block-nav-order")!.build(identity);
    const extraBlob = documentTextBlob({ sections: extra });
    expect(extraBlob).toContain("Aurora Kettle");
    expect(extraBlob.toLowerCase()).not.toContain("visivra");
  });

  it("do zero sem identidade usa Produto, não o catálogo Visivra", () => {
    const blank = buildDtcFromScratch();
    const blob = documentTextBlob(blank);
    expect(blob).toContain("Produto");
    expect(blob.toLowerCase()).not.toContain("visivra");
  });
});

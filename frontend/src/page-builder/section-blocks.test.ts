import { describe, expect, it } from "vitest";
import {
  SECTION_BLOCKS,
  VISIVRA_FROM_SCRATCH_RECIPE,
} from "./section-blocks";
import { WIDGET_REGISTRY } from "./widget-registry";
import { SECTION_LAYOUTS } from "./section-layouts";

describe("blocos do zero", () => {
  it("tem blocos para nav, hero, prova, cta e cookies", () => {
    const ids = SECTION_BLOCKS.map((b) => b.id);
    expect(ids).toContain("block-nav-order");
    expect(ids).toContain("block-hero-2col");
    expect(ids).toContain("block-trust-4");
    expect(ids).toContain("block-benefits-list");
    expect(ids).toContain("block-cookie-modal");
    expect(ids).toContain("block-legal-footer");
    expect(ids).toContain("block-why-band");
    expect(ids).toContain("block-yellow-cta-soft");
  });

  it("receita Visivra monta secções válidas com widgets do registry", () => {
    const sections = VISIVRA_FROM_SCRATCH_RECIPE.flatMap((id) => {
      const block = SECTION_BLOCKS.find((b) => b.id === id);
      expect(block).toBeDefined();
      return block!.build();
    });
    expect(sections.length).toBeGreaterThanOrEqual(8);
    for (const sec of sections) {
      for (const col of sec.columns) {
        for (const widget of col.widgets) {
          expect(WIDGET_REGISTRY[widget.type]).toBeDefined();
        }
      }
    }
  });

  it("estruturas de layout incluem hero e menu", () => {
    const labels = SECTION_LAYOUTS.map((l) => l.label);
    expect(labels).toContain("20/60/20");
    expect(labels).toContain("45/55");
    expect(labels).toContain("4");
  });

  it("cookie modal block usa variant modal", () => {
    const block = SECTION_BLOCKS.find((b) => b.id === "block-cookie-modal");
    const widget = block!.build()[0].columns[0].widgets[0];
    expect(widget.type).toBe("cookieBanner");
    expect(widget.content.variant).toBe("modal");
  });
});

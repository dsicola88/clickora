import { describe, expect, it } from "vitest";
import { TEMPLATES, buildPageFromTemplate } from "./templates";
import { WIDGET_REGISTRY } from "./widget-registry";
import { readContainerChildren } from "./widget-tree";
import type { WidgetNode } from "./types";

function flattenWidgets(widgets: WidgetNode[]): WidgetNode[] {
  return widgets.flatMap((w) =>
    w.type === "container" ? [w, ...flattenWidgets(readContainerChildren(w))] : [w],
  );
}

function typesOf(id: string) {
  const template = TEMPLATES.find((t) => t.id === id);
  expect(template).toBeDefined();
  const sections = buildPageFromTemplate(template!);
  const types = sections.flatMap((sec) =>
    sec.columns.flatMap((col) => flattenWidgets(col.widgets).map((w) => w.type)),
  );
  return { template, sections, types };
}

describe("presell Nitric Boost e Neotonics", () => {
  it("estão na biblioteca presell", () => {
    expect(TEMPLATES.find((t) => t.id === "presell-nitric-boost")?.category).toBe("presell");
    expect(TEMPLATES.find((t) => t.id === "presell-neotonics")?.category).toBe("presell");
  });

  it("Nitric Boost tem menu, oferta, FAQ e cookies", () => {
    const { sections, types } = typesOf("presell-nitric-boost");
    expect(sections.length).toBeGreaterThanOrEqual(10);
    expect(types).toContain("navMenu");
    expect(types).toContain("button");
    expect(types).toContain("priceTable");
    expect(types).toContain("faq");
    expect(types).toContain("cookieBanner");
    expect(sections[0].styles.position?.desktop).toBe("sticky");
  });

  it("Neotonics tem ingredientes, depoimentos, packs e cookies", () => {
    const { sections, types } = typesOf("presell-neotonics");
    expect(sections.length).toBeGreaterThanOrEqual(10);
    expect(types).toContain("navMenu");
    expect(types).toContain("testimonials");
    expect(types).toContain("priceTable");
    expect(types).toContain("faq");
    expect(types).toContain("cookieBanner");
    expect(types).toContain("html");
    const json = JSON.stringify(sections);
    expect(json).toContain("100% Money-Back Guarantee");
    expect(json).toContain('"price":"49"');
    expect(json).toContain('"price":"59"');
    expect(json).toContain("SECURE CHECKOUT");
    expect(json).toContain("KEY TO A RADIANT LOOK");
  });

  it("todos os widgets resolvem no registry", () => {
    for (const id of ["presell-nitric-boost", "presell-neotonics"]) {
      const { sections } = typesOf(id);
      for (const sec of sections) {
        for (const col of sec.columns) {
          for (const widget of flattenWidgets(col.widgets)) {
            expect(WIDGET_REGISTRY[widget.type]).toBeDefined();
          }
        }
      }
    }
  });
});

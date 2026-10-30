import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVisivraFromScratch } from "./section-blocks";
import { TEMPLATES, buildPageFromTemplate } from "./templates";
import { exportPageToHtml } from "./export-html";
import { WIDGET_REGISTRY } from "./widget-registry";
import { readContainerChildren } from "./widget-tree";

describe("editor manual — página Visivra ponta a ponta do zero", () => {
  it("menu: logo não encolhe; links e Order Now ao lado com wrap", () => {
    const doc = buildVisivraFromScratch();
    const nav = doc.sections[0];
    expect(nav.columns).toHaveLength(1);
    expect(nav.styles.position?.desktop).toBe("sticky");
    const bar = nav.columns[0].widgets[0];
    expect(bar.type).toBe("container");
    expect(bar.content.wrap).toBe("wrap");
    const kids = readContainerChildren(bar);
    expect(kids.map((k) => k.type)).toEqual(["heading", "navMenu", "button"]);
    expect(String(kids[0].content.text)).toBe("Visivra™");
    expect(kids[0].styles.flexShrink?.desktop).toBe(0);
    expect(String(kids[2].content.text)).toBe("Order Now");
    expect(kids[2].styles.background).toBe("#ffd200");
    expect(kids[2].styles.flexShrink?.desktop).toBe(0);
  });

  it("tem as mesmas secções do modelo (hero, selos, benefícios, cookie)", () => {
    const fromScratch = buildVisivraFromScratch();
    const template = TEMPLATES.find((t) => t.id === "presell-dtc-vision")!;
    const fromTemplate = buildPageFromTemplate(template);
    expect(fromScratch.sections).toHaveLength(fromTemplate.length);

    const types = fromScratch.sections.flatMap((sec) =>
      sec.columns.flatMap((col) =>
        col.widgets.flatMap((w) =>
          w.type === "container" ? [w.type, ...readContainerChildren(w).map((c) => c.type)] : [w.type],
        ),
      ),
    );
    expect(types).toContain("navMenu");
    expect(types).toContain("html");
    expect(types).toContain("button");
    expect(types).toContain("iconList");
    expect(types).toContain("cookieBanner");
    expect(types).toContain("backToTop");
    expect(fromScratch.sections.some((s) => s.columns.length === 4)).toBe(true);

    for (const sec of fromScratch.sections) {
      for (const col of sec.columns) {
        for (const widget of col.widgets) {
          expect(WIDGET_REGISTRY[widget.type]).toBeDefined();
        }
      }
    }
  });

  it("export HTML empilha colunas no telemóvel (o menu não tapa o título)", () => {
    const doc = buildVisivraFromScratch();
    doc.sections = doc.sections.filter(
      (sec) =>
        !sec.columns.some((col) => col.widgets.some((w) => w.type === "cookieBanner")),
    );
    const html = exportPageToHtml(doc);
    expect(html).toContain("Order Now");
    expect(html).toContain("Visivra : Natural Support");
    expect(html).toContain("Why Choose Visivra");
    expect(html).toContain("GET A DISCOUNT NOW!");
    expect(html).toMatch(/data-pb-columns\]\[data-pb-stackable="1"\]/);
    expect(html).toMatch(/@media \(max-width: 1024px\)/);
    expect(html).toContain('data-pb-content="1"');

    const outDir = resolve(__dirname, "../../public/qa");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "visivra-first-fold-from-scratch.html"), html, "utf8");
  });
});

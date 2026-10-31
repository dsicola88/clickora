import { describe, expect, it } from "vitest";
import { TEMPLATES, buildPageFromTemplate } from "./templates";
import {
  DCLICKORA_NAVY_SAAS_THEME_ID,
  createDclickoraNavySaasDocument,
} from "./templates.dclickoraNavy";
import { readContainerChildren } from "./widget-tree";
import type { WidgetNode } from "./types";

function flattenWidgets(widgets: WidgetNode[]): WidgetNode[] {
  return widgets.flatMap((w) =>
    w.type === "container" ? [w, ...flattenWidgets(readContainerChildren(w))] : [w],
  );
}

describe("Landing DClickora — Navy SaaS template", () => {
  const template = TEMPLATES.find((t) => t.id === DCLICKORA_NAVY_SAAS_THEME_ID);

  it("está no catálogo de modelos (admin + afiliado)", () => {
    expect(template).toBeDefined();
    expect(template?.category).toBe("landing");
    expect(template?.name).toMatch(/Navy SaaS/i);
    expect(template?.buildDocument).toBeTypeOf("function");
  });

  it("monta menu, hero, pilares, funil, preços, FAQ e CTA", () => {
    expect(template).toBeDefined();
    const sections = buildPageFromTemplate(template!);
    expect(sections.length).toBeGreaterThanOrEqual(8);

    const types = sections.flatMap((sec) =>
      sec.columns.flatMap((col) => flattenWidgets(col.widgets).map((w) => w.type)),
    );

    expect(types).toContain("navMenu");
    expect(types).toContain("image");
    expect(types).toContain("button");
    expect(types).toContain("icon");
    expect(types).toContain("priceTable");
    expect(types).toContain("faq");
    expect(types).toContain("menuAnchor");

    const priceCount = types.filter((t) => t === "priceTable").length;
    expect(priceCount).toBe(3);
  });

  it("documento completo usa tema navy e fundo escuro", () => {
    const doc = createDclickoraNavySaasDocument();
    expect(doc.settings.themePreset).toBe(DCLICKORA_NAVY_SAAS_THEME_ID);
    expect(doc.settings.background).toMatch(/#060d21/i);
    expect(doc.settings.globalDesign?.primary).toMatch(/#0088ff/i);
    expect(doc.sections.length).toBeGreaterThanOrEqual(8);
  });
});

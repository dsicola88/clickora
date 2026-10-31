import { describe, expect, it } from "vitest";
import { TEMPLATES, buildPageFromTemplate } from "./templates";
import { PRO_STUDIO_TEMPLATES } from "./templates.proStudio";
import { WIDGET_REGISTRY } from "./widget-registry";
import { readContainerChildren } from "./widget-tree";
import type { WidgetNode } from "./types";

function flattenWidgets(widgets: WidgetNode[]): WidgetNode[] {
  return widgets.flatMap((w) =>
    w.type === "container" ? [w, ...flattenWidgets(readContainerChildren(w))] : [w],
  );
}

describe("PRO_STUDIO_TEMPLATES", () => {
  it("expõe 10 modelos profissionais no catálogo partilhado", () => {
    expect(PRO_STUDIO_TEMPLATES).toHaveLength(10);
    for (const t of PRO_STUDIO_TEMPLATES) {
      expect(TEMPLATES.find((x) => x.id === t.id)).toBeDefined();
      expect(t.buildDocument).toBeTypeOf("function");
      expect(["landing", "presell"]).toContain(t.category);
    }
  });

  it.each(PRO_STUDIO_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s constrói secções com widgets registados",
    (_id, template) => {
      const sections = buildPageFromTemplate(template);
      expect(sections.length).toBeGreaterThanOrEqual(2);

      const types = sections.flatMap((sec) =>
        sec.columns.flatMap((col) => flattenWidgets(col.widgets).map((w) => w.type)),
      );
      expect(types.length).toBeGreaterThan(0);
      for (const type of types) {
        expect(WIDGET_REGISTRY[type], `widget ${type} em ${template.id}`).toBeDefined();
      }

      const doc = template.buildDocument();
      expect(doc.settings.themePreset).toBe(template.id);
      expect(doc.sections.length).toBe(sections.length);
    },
  );
});

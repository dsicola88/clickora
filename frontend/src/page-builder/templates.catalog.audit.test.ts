/**
 * Auditoria profissional do catálogo de templates (admin + afiliado).
 */
import { describe, expect, it } from "vitest";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { TEMPLATES, buildPageFromTemplate, type TemplateDefinition } from "./templates";
import { PRO_STUDIO_TEMPLATES } from "./templates.proStudio";
import { DCLICKORA_NAVY_SAAS_THEME_ID } from "./templates.dclickoraNavy";
import { WIDGET_REGISTRY } from "./widget-registry";
import { readContainerChildren } from "./widget-tree";
import type { WidgetNode } from "./types";

function flattenWidgets(widgets: WidgetNode[]): WidgetNode[] {
  return widgets.flatMap((w) =>
    w.type === "container" ? [w, ...flattenWidgets(readContainerChildren(w))] : [w],
  );
}

function allWidgets(template: TemplateDefinition): WidgetNode[] {
  return buildPageFromTemplate(template).flatMap((sec) =>
    sec.columns.flatMap((col) => flattenWidgets(col.widgets)),
  );
}

function toKebab(name: string): string {
  const raw = name.trim();
  if (!raw) return "";
  if (raw.includes("-") || raw.includes("_") || raw.includes(" ")) {
    return raw
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((p) => p.toLowerCase())
      .join("-");
  }
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function iconExists(name: string): boolean {
  const key = toKebab(name);
  return Boolean(key && key in dynamicIconImports);
}

describe("catálogo TEMPLATES — auditoria profissional", () => {
  it("tem IDs únicos e metadados preenchidos", () => {
    const seen = new Set<string>();
    for (const t of TEMPLATES) {
      expect(t.id, "id vazio").toBeTruthy();
      expect(seen.has(t.id), `id duplicado: ${t.id}`).toBe(false);
      seen.add(t.id);
      expect(t.name.trim().length).toBeGreaterThan(2);
      expect(t.description.trim().length).toBeGreaterThan(10);
      expect(t.thumbnail.trim().length).toBeGreaterThan(3);
      expect(["landing", "presell", "vsl", "lead"]).toContain(t.category);
    }
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(28);
  });

  it("Navy SaaS + Pro Studio estão no catálogo partilhado", () => {
    expect(TEMPLATES.some((t) => t.id === DCLICKORA_NAVY_SAAS_THEME_ID)).toBe(true);
    expect(PRO_STUDIO_TEMPLATES).toHaveLength(10);
    for (const t of PRO_STUDIO_TEMPLATES) {
      expect(TEMPLATES.find((x) => x.id === t.id)).toBeDefined();
    }
  });

  it("cada template constrói secções com widgets válidos", () => {
    for (const t of TEMPLATES) {
      const sections = buildPageFromTemplate(t);
      expect(sections.length, t.id).toBeGreaterThan(0);
      for (const sec of sections) {
        expect(sec.columns.length, `${t.id} sec sem colunas`).toBeGreaterThan(0);
        for (const col of sec.columns) {
          expect(col.widthPercent?.desktop).toBeGreaterThan(0);
        }
      }
      const widgets = allWidgets(t);
      expect(widgets.length, t.id).toBeGreaterThan(0);
      for (const w of widgets) {
        expect(WIDGET_REGISTRY[w.type], `${t.id} widget ${w.type}`).toBeDefined();
      }
    }
  });

  it("templates com buildDocument hidratam tema e fundo", () => {
    const withDoc = TEMPLATES.filter((t) => t.buildDocument);
    expect(withDoc.length).toBeGreaterThanOrEqual(11);
    for (const t of withDoc) {
      const doc = t.buildDocument!();
      expect(doc.sections.length, t.id).toBeGreaterThan(0);
      expect(doc.settings.maxContentWidth).toBeGreaterThan(0);
      expect(String(doc.settings.background || "").length, `${t.id} background`).toBeGreaterThan(0);
      expect(doc.settings.themePreset || t.id).toBeTruthy();
    }
  });

  it("ícones Lucide nos templates profissionais resolvem", () => {
    const focus = [
      TEMPLATES.find((t) => t.id === DCLICKORA_NAVY_SAAS_THEME_ID)!,
      ...PRO_STUDIO_TEMPLATES,
    ];
    const bad: string[] = [];
    for (const t of focus) {
      for (const w of allWidgets(t)) {
        if (w.type === "icon") {
          const name = String(w.content.name ?? "");
          if (!iconExists(name)) bad.push(`${t.id}:icon:${name}`);
        }
        if (w.type === "infoBox") {
          const name = String(w.content.iconName ?? "");
          if (name && !iconExists(name)) bad.push(`${t.id}:infoBox:${name}`);
        }
        if (w.type === "iconList") {
          const items = Array.isArray(w.content.items) ? w.content.items : [];
          for (const it of items) {
            const row = it as { iconName?: string };
            const name = String(row.iconName ?? "");
            if (name && !iconExists(name)) bad.push(`${t.id}:iconList:${name}`);
          }
        }
      }
    }
    expect(bad, bad.join(", ")).toEqual([]);
  });

  it("Navy SaaS tem estrutura profissional completa", () => {
    const t = TEMPLATES.find((x) => x.id === DCLICKORA_NAVY_SAAS_THEME_ID)!;
    const types = allWidgets(t).map((w) => w.type);
    for (const need of [
      "navMenu",
      "image",
      "button",
      "container",
      "infoBox",
      "priceTable",
      "faq",
      "testimonials",
      "menuAnchor",
    ]) {
      expect(types, need).toContain(need);
    }
    expect(types.filter((x) => x === "priceTable")).toHaveLength(3);
    const doc = t.buildDocument!();
    expect(doc.settings.themePreset).toBe(DCLICKORA_NAVY_SAAS_THEME_ID);
    expect(doc.sections.length).toBeGreaterThanOrEqual(10);
  });

  it("Pro Studio: landings e presells misturam widgets de conversão", () => {
    for (const t of PRO_STUDIO_TEMPLATES) {
      const types = new Set(allWidgets(t).map((w) => w.type));
      expect(types.has("heading") || types.has("text"), t.id).toBe(true);
      expect(
        types.has("button") || types.has("ctaBox") || types.has("form") || types.has("priceTable"),
        `${t.id} sem CTA/conversão`,
      ).toBe(true);
      // Sem headings vazios
      for (const w of allWidgets(t)) {
        if (w.type === "heading") {
          expect(String(w.content.text ?? "").trim(), `${t.id} heading vazio`).not.toBe("");
        }
        if (w.type === "button") {
          expect(String(w.content.text ?? "").trim(), `${t.id} button vazio`).not.toBe("");
        }
        if (w.type === "image") {
          expect(String(w.content.src ?? "").trim(), `${t.id} image sem src`).not.toBe("");
        }
        if (w.type === "iconList") {
          expect(w.content.textColor, `${t.id} iconList textColor legado`).toBeUndefined();
          const items = Array.isArray(w.content.items) ? w.content.items : [];
          for (const it of items) {
            expect((it as { iconName?: string }).iconName, `${t.id} iconList`).toBeTruthy();
          }
        }
      }
    }
  });
});

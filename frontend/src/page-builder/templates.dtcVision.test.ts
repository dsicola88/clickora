import { describe, expect, it } from "vitest";
import { TEMPLATES, buildPageFromTemplate } from "./templates";
import { WIDGET_REGISTRY } from "./widget-registry";
import { createWidget } from "./factory";
import { readContainerChildren } from "./widget-tree";
import type { WidgetNode } from "./types";

function flattenWidgets(widgets: WidgetNode[]): WidgetNode[] {
  return widgets.flatMap((w) =>
    w.type === "container" ? [w, ...flattenWidgets(readContainerChildren(w))] : [w],
  );
}

describe("presell-dtc-vision template (Visivra ponta a ponta)", () => {
  const template = TEMPLATES.find((t) => t.id === "presell-dtc-vision");

  it("está na biblioteca de modelos presell", () => {
    expect(template).toBeDefined();
    expect(template?.category).toBe("presell");
    expect(template?.name).toMatch(/Visivra/i);
  });

  it("inclui menu sticky em linha, hero, selos, benefícios, CTA e cookie modal", () => {
    expect(template).toBeDefined();
    const sections = buildPageFromTemplate(template!);
    expect(sections.length).toBeGreaterThanOrEqual(8);

    const types = sections.flatMap((sec) =>
      sec.columns.flatMap((col) => flattenWidgets(col.widgets).map((w) => w.type)),
    );

    expect(types).toContain("navMenu");
    expect(types).toContain("button");
    expect(types).toContain("iconList");
    expect(types).toContain("html");
    expect(types).toContain("cookieBanner");
    expect(types).toContain("backToTop");

    const nav = sections[0];
    expect(nav.columns).toHaveLength(1);
    expect(nav.styles.position?.desktop).toBe("sticky");
    expect(nav.styles.top?.desktop).toBe("0");
    expect(nav.styles.background).toBe("#ffffff");

    const flatNav = flattenWidgets(nav.columns.flatMap((c) => c.widgets));
    const orderBtn = flatNav.find((w) => w.type === "button");
    expect(orderBtn?.content.iconName).toBe("ShoppingCart");
    expect(String(orderBtn?.content.text)).toMatch(/Order Now/i);
    expect(orderBtn?.styles.background).toBe("#ffd200");

    const cookie = sections
      .flatMap((s) => s.columns.flatMap((c) => flattenWidgets(c.widgets)))
      .find((w) => w.type === "cookieBanner");
    expect(cookie?.content.variant).toBe("modal");
    expect(String(cookie?.content.allowLabel)).toMatch(/ACCEPT ALL/i);

    const iconList = sections
      .flatMap((s) => s.columns.flatMap((c) => flattenWidgets(c.widgets)))
      .find((w) => w.type === "iconList");
    expect(iconList?.content.iconBg).toBe("#0b3d7a");
    expect(Array.isArray(iconList?.content.items) && (iconList!.content.items as unknown[]).length).toBe(
      3,
    );

    const sealSection = sections.find((s) => s.columns.length === 4);
    expect(sealSection).toBeDefined();
  });

  it("todos os widgets resolvem no registry", () => {
    expect(template).toBeDefined();
    for (const sec of buildPageFromTemplate(template!)) {
      for (const col of sec.columns) {
        for (const widget of flattenWidgets(col.widgets)) {
          expect(WIDGET_REGISTRY[widget.type]).toBeDefined();
        }
      }
    }
  });

  it("cookieBanner modal e botão com ícone têm defaults editáveis", () => {
    const cookie = createWidget("cookieBanner");
    expect(cookie.content.variant).toBe("modal");
    expect(String(cookie.content.declineLabel)).toMatch(/Close/i);
    expect(cookie.content.followLanguage).toBe(false);

    const btn = createWidget("button");
    expect(btn.type).toBe("button");
  });
});

import { describe, expect, it } from "vitest";
import { createSection, createWidget } from "./factory";
import {
  scaleSpacingForDevice,
  scaleTypographyForDevice,
  viewportToBuilderDevice,
} from "./responsiveDefaults";
import { stylesToCss } from "./style-utils";
import { exportPageToHtml } from "./export-html";
import type { PageDocument } from "./types";
import { BUILDER_PUBLIC_RESPONSIVE_CSS, buildDocumentResponsiveCss } from "./builderPublicCss";

describe("viewportToBuilderDevice", () => {
  it("classifica mobile / tablet / desktop", () => {
    expect(viewportToBuilderDevice(390)).toBe("mobile");
    expect(viewportToBuilderDevice(767)).toBe("mobile");
    expect(viewportToBuilderDevice(768)).toBe("tablet");
    expect(viewportToBuilderDevice(1024)).toBe("tablet");
    expect(viewportToBuilderDevice(1025)).toBe("desktop");
  });
});

describe("factory defaults já responsivos", () => {
  it("heading e secção trazem mobile tipografia/padding", () => {
    const heading = createWidget("heading");
    expect(heading.styles.typography?.desktop?.fontSize).toBe(36);
    expect(heading.styles.typography?.mobile?.fontSize).toBe(26);

    const section = createSection(2);
    expect(section.styles.padding?.mobile?.top).toBe(36);
    expect(section.columns[0].widthPercent?.mobile).toBe(100);
    expect(section.columns[0].widthPercent?.tablet).toBe(100);
  });
});

describe("escala implícita para páginas só-desktop", () => {
  it("reduz tipografia grande no telemóvel sem override", () => {
    const scaled = scaleTypographyForDevice(
      { desktop: { fontSize: 40, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0, textAlign: "left", textTransform: "none", fontStyle: "normal", textDecoration: "none", wordSpacing: 0 } },
      "mobile",
    );
    expect(scaled?.fontSize).toBe(Math.round(40 * 0.78));
  });

  it("respeita override mobile explícito", () => {
    const scaled = scaleTypographyForDevice(
      {
        desktop: { fontSize: 40, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0, textAlign: "left", textTransform: "none", fontStyle: "normal", textDecoration: "none", wordSpacing: 0 },
        mobile: { fontSize: 22, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0, textAlign: "left", textTransform: "none", fontStyle: "normal", textDecoration: "none", wordSpacing: 0 },
      },
      "mobile",
    );
    expect(scaled?.fontSize).toBe(22);
  });

  it("stylesToCss aplica escala implícita de padding", () => {
    const css = stylesToCss(
      {
        padding: {
          desktop: { top: 60, right: 20, bottom: 60, left: 20, unit: "px" },
        },
      },
      "mobile",
    );
    expect(String(css.padding)).toContain("px");
    expect(String(css.padding)).not.toBe("60px 20px 60px 20px");
  });

  it("scaleSpacingForDevice existe e encolhe verticais", () => {
    const s = scaleSpacingForDevice(
      { desktop: { top: 60, right: 20, bottom: 60, left: 20, unit: "px" } },
      "mobile",
    );
    expect(s?.top).toBeLessThan(60);
  });

  it("não inventa padding horizontal onde o autor pôs 0", () => {
    const s = scaleSpacingForDevice(
      { desktop: { top: 60, right: 0, bottom: 60, left: 0, unit: "px" } },
      "mobile",
    );
    expect(s?.right).toBe(0);
    expect(s?.left).toBe(0);
    expect(s?.top).toBeLessThan(60);
  });
});

describe("export / CSS público", () => {
  it("CSS base empilha data-pb-columns e evita overflow de texto", () => {
    expect(BUILDER_PUBLIC_RESPONSIVE_CSS).toContain("data-pb-columns");
    expect(BUILDER_PUBLIC_RESPONSIVE_CSS).toContain("data-pb-stackable");
    expect(BUILDER_PUBLIC_RESPONSIVE_CSS).toContain("overflow-wrap: anywhere");
    expect(BUILDER_PUBLIC_RESPONSIVE_CSS).toContain("width: 100% !important");
  });

  it("export inclui CSS responsivo e data-pb-id", () => {
    const section = createSection(2);
    section.columns[0].widgets.push(createWidget("heading"));
    const doc: PageDocument = {
      id: "page_test",
      name: "Teste",
      sections: [section],
      settings: { background: "#fff" },
    };
    const html = exportPageToHtml(doc);
    expect(html).toContain("data-pb-columns");
    expect(html).toContain("data-pb-stackable");
    expect(html).toContain("data-pb-id");
    expect(html).toContain('data-pb-content="1"');
    expect(html).toMatch(/@media \(max-width: 1024px\)/);
    const css = buildDocumentResponsiveCss(doc);
    expect(css).toContain('[data-pb-content="1"]');
    expect(css).not.toMatch(/\[data-pb-id="[^"]+"\] h1,/);
    expect(css.length).toBeGreaterThan(80);
  });
});

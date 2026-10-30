import { describe, expect, it } from "vitest";
import { createWidget } from "./factory";
import { WIDGET_LIST, WIDGET_REGISTRY } from "./widget-registry";
import type { WidgetType } from "./types";
import { buildWidgetMotionCss, widgetHasMotion } from "./widget-motion";
import { stylesToCssWidgetContent, stylesToCssWidgetShell } from "./style-utils";

/** Widgets essenciais de landing → devem existir no registry. */
const LANDING_WIDGET_COVERAGE: WidgetType[] = [
  "container",
  "heading",
  "text",
  "image",
  "video",
  "stickyVideo",
  "button",
  "starRating",
  "divider",
  "googleMaps",
  "icon",
  "imageBox",
  "infoBox",
  "gallery",
  "imageCarousel",
  "iconList",
  "counter",
  "spacer",
  "testimonials",
  "tabs",
  "faq",
  "socialIcons",
  "progressTracker",
  "html",
  "menuAnchor",
  "alert",
  "form",
  "animatedHeadline",
  "priceTable",
  "flipBox",
  "ctaBox",
  "countdown",
  "navMenu",
  "lottie",
  "offCanvas",
  "shareButtons",
  "tableOfContents",
];

describe("section chrome (overlay + shape dividers)", () => {
  it("exports shape presets and relative chrome detection", async () => {
    const { SHAPE_DIVIDER_PRESETS, sectionNeedsRelativeChrome } = await import("./section-chrome");
    expect(SHAPE_DIVIDER_PRESETS.some((p) => p.value === "waves")).toBe(true);
    const { createSection } = await import("./factory");
    const sec = createSection(1);
    expect(sectionNeedsRelativeChrome(sec, false)).toBe(false);
    sec.backgroundOverlay = { color: "rgba(0,0,0,1)", opacity: 40 };
    expect(sectionNeedsRelativeChrome(sec, false)).toBe(true);
    sec.backgroundOverlay = undefined;
    sec.shapeDividerBottom = { preset: "waves", color: "#fff", heightPx: 60 };
    expect(sectionNeedsRelativeChrome(sec, false)).toBe(true);
  });

  it("resolves page global design CSS kit", async () => {
    const { resolveGlobalDesign } = await import("./page-global-design");
    const g = resolveGlobalDesign({
      maxContentWidth: 1140,
      globalDesign: { accent: "#112233", fontPrimary: "Georgia, serif" },
    });
    expect(g.accent).toBe("#112233");
    expect(g.fontPrimary).toBe("Georgia, serif");
    expect(g.primary).toBeTruthy();
  });
});

describe("landing widget coverage", () => {
  it("registers every essential landing widget", () => {
    for (const t of LANDING_WIDGET_COVERAGE) {
      expect(WIDGET_REGISTRY[t], `missing ${t}`).toBeTruthy();
    }
  });

  it("can factory-create every registered widget type", () => {
    for (const def of WIDGET_LIST) {
      const w = createWidget(def.type);
      expect(w.type).toBe(def.type);
      expect(w.id).toBeTruthy();
      expect(w.content).toBeTypeOf("object");
      expect(w.styles).toBeTypeOf("object");
    }
  });

  it("exposes motion effects field on created widgets (optional)", () => {
    const w = createWidget("heading");
    expect(w.effects).toBeUndefined();
    w.effects = { entranceAnimation: "fadeIn", hoverTransform: "scale(1.05)" };
    expect(w.effects.entranceAnimation).toBe("fadeIn");
  });

  it("every widget supports Style+Advanced motion pipeline", () => {
    for (const def of WIDGET_LIST) {
      const w = createWidget(def.type);
      w.effects = {
        entranceAnimation: "fadeIn",
        hoverTransform: "scale(1.05)",
        hoverColor: "#fff",
        hoverBackground: "#111",
        hoverBorderColor: "#222",
      };
      expect(widgetHasMotion(w.effects, w.content)).toBe(true);
      const css = buildWidgetMotionCss(w.id, w.effects, w.content);
      expect(css).toContain(":hover");
      expect(css).toContain("fadeIn");
      expect(() => stylesToCssWidgetContent(w.styles, "desktop")).not.toThrow();
    }
  });

  it("resolves hyphenated Lucide icon names (iconList/infoBox)", async () => {
    const { resolveLucideIcon } = await import("./lucide-icon");
    expect(resolveLucideIcon("arrow-right")).toBeTruthy();
    expect(resolveLucideIcon("ShoppingCart")).toBeTruthy();
    expect(resolveLucideIcon("check")).toBeTruthy();
  });

  it("absolute offsets and block align land on the widget shell", async () => {
    const { createWidget } = await import("./factory");
    const { stylesToCssWidgetShell, stylesToCssWidgetContent } = await import("./style-utils");
    const w = createWidget("text");
    w.styles.position = { desktop: "absolute" };
    w.styles.top = { desktop: "12px" };
    w.styles.right = { desktop: "8px" };
    w.styles.bottom = { desktop: "4px" };
    w.styles.left = { desktop: "16px" };
    w.styles.align = { desktop: "center" };
    w.styles.width = { desktop: "280px" };
    const shell = stylesToCssWidgetShell(w.styles, "desktop");
    const content = stylesToCssWidgetContent(w.styles, "desktop");
    expect(shell.position).toBe("absolute");
    expect(shell.top).toBe("12px");
    expect(shell.right).toBe("8px");
    expect(shell.bottom).toBe("4px");
    expect(shell.left).toBe("16px");
    expect(shell.marginLeft).toBe("auto");
    expect(shell.marginRight).toBe("auto");
    expect(content.position).toBeUndefined();
    expect(content.left).toBeUndefined();
  });

  it("navMenu sticky shell keeps position+top together (content scrolls under bar)", () => {
    const w = createWidget("navMenu");
    w.styles = {
      ...w.styles,
      position: { desktop: "sticky" },
      top: { desktop: "0" },
      zIndex: { desktop: 200 },
      background: "#ffffff",
    };
    const shell = stylesToCssWidgetShell(w.styles, "desktop");
    const content = stylesToCssWidgetContent(w.styles, "desktop");
    expect(shell.position).toBe("sticky");
    expect(shell.top).toBe("0");
    expect(shell.zIndex).toBe(200);
    expect(content.position).toBeUndefined();
    expect(content.top).toBeUndefined();
    expect(w.content).toMatchObject({
      layout: "horizontal",
      pointer: "underline",
      stickyMode: "none",
    });
  });

  it("creates default page popups and widget interactions shapes", async () => {
    const { createEmptyPage, createPagePopup, createWidget: cw } = await import("./factory");
    const page = createEmptyPage("x");
    expect(Array.isArray(page.popups)).toBe(true);
    const pop = createPagePopup("Oferta");
    expect(pop.displayMode).toBe("modal");
    expect(pop.position).toBe("center");
    expect(pop.animation).toBe("fadeUp");
    expect(typeof pop.delayMs).toBe("number");
    const cookie = cw("cookieBanner");
    expect(cookie.content.variant).toBe("modal");
    expect(cookie.content.animation).toBe("fadeUp");
    expect(cookie.content.position).toBe("center");
    const btn = cw("button");
    expect(btn.interactions === undefined || Array.isArray(btn.interactions)).toBe(true);
  });

  it("builds motion path CSS and mask presets", async () => {
    const { buildWidgetMotionCss, widgetHasMotion } = await import("./widget-motion");
    const { resolveWidgetClipPath } = await import("./widget-mask");
    const w = createWidget("heading");
    w.effects = { motionPath: "arc", motionPathDurationMs: 3000 };
    expect(widgetHasMotion(w.effects)).toBe(true);
    expect(buildWidgetMotionCss(w.id, w.effects)).toContain("offset-path");
    w.cssMask = "circle";
    expect(resolveWidgetClipPath(w)).toContain("circle");
  });

  it("detects section slideshow chrome", async () => {
    const { sectionNeedsRelativeChrome } = await import("./section-chrome");
    const { createSection } = await import("./factory");
    const sec = createSection(1);
    sec.backgroundSlideshow = ["https://example.com/a.jpg", "https://example.com/b.jpg"];
    expect(sectionNeedsRelativeChrome(sec, false)).toBe(true);
  });
});

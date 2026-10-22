import { describe, expect, it } from "vitest";
import { createWidget } from "./factory";
import { WIDGET_LIST, WIDGET_REGISTRY } from "./widget-registry";
import type { WidgetType } from "./types";
import { buildWidgetMotionCss, widgetHasMotion } from "./widget-motion";
import { stylesToCssWidgetContent, stylesToCssWidgetShell } from "./style-utils";

/** Elementor Free + Essential (landing) → Clickora. */
const ELEMENTOR_LANDING_MAP: Array<{ elementor: string; ours: WidgetType | WidgetType[] }> = [
  { elementor: "Container", ours: "container" },
  { elementor: "Heading", ours: "heading" },
  { elementor: "Text Editor", ours: "text" },
  { elementor: "Image", ours: "image" },
  { elementor: "Video", ours: ["video", "stickyVideo"] },
  { elementor: "Button", ours: "button" },
  { elementor: "Star Rating", ours: "starRating" },
  { elementor: "Divider", ours: "divider" },
  { elementor: "Google Maps", ours: "googleMaps" },
  { elementor: "Icon", ours: "icon" },
  { elementor: "Image Box", ours: "imageBox" },
  { elementor: "Icon Box", ours: "infoBox" },
  { elementor: "Basic Gallery", ours: "gallery" },
  { elementor: "Image Carousel", ours: "imageCarousel" },
  { elementor: "Icon List", ours: "iconList" },
  { elementor: "Counter", ours: "counter" },
  { elementor: "Spacer", ours: "spacer" },
  { elementor: "Testimonial", ours: "testimonials" },
  { elementor: "Tabs", ours: "tabs" },
  { elementor: "Accordion / FAQ", ours: "faq" },
  { elementor: "Social Icons", ours: "socialIcons" },
  { elementor: "Progress Bar", ours: "progressTracker" },
  { elementor: "HTML", ours: "html" },
  { elementor: "Menu Anchor", ours: "menuAnchor" },
  { elementor: "Alert", ours: "alert" },
  { elementor: "Form (Pro)", ours: "form" },
  { elementor: "Animated Headline (Pro)", ours: "animatedHeadline" },
  { elementor: "Price Table (Pro)", ours: "priceTable" },
  { elementor: "Flip Box (Pro)", ours: "flipBox" },
  { elementor: "Call to Action (Pro)", ours: "ctaBox" },
  { elementor: "Countdown (Pro)", ours: "countdown" },
  { elementor: "Nav Menu / Menu", ours: "navMenu" },
];

describe("Elementor landing parity", () => {
  it("maps every listed Elementor landing widget to a registry entry", () => {
    for (const row of ELEMENTOR_LANDING_MAP) {
      const types = Array.isArray(row.ours) ? row.ours : [row.ours];
      for (const t of types) {
        expect(WIDGET_REGISTRY[t], `missing ${row.elementor} → ${t}`).toBeTruthy();
      }
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

  it("every widget supports Elementor Style+Advanced motion pipeline", () => {
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
      // Style shell must always resolve without throw
      expect(() => stylesToCssWidgetContent(w.styles, "desktop")).not.toThrow();
    }
  });

  it("resolves hyphenated Lucide icon names (iconList/infoBox)", async () => {
    const { resolveLucideIcon } = await import("./lucide-icon");
    expect(resolveLucideIcon("arrow-right")).toBeTruthy();
    expect(resolveLucideIcon("ShoppingCart")).toBeTruthy();
    expect(resolveLucideIcon("check")).toBeTruthy();
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
});

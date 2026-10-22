import { describe, expect, it } from "vitest";
import {
  buildWidgetMotionCss,
  motionClassName,
  resolveWidgetEffects,
  widgetHasMotion,
} from "./widget-motion";

describe("widget-motion", () => {
  it("builds entrance + hover css for any widget id", () => {
    const css = buildWidgetMotionCss("w-1", {
      entranceAnimation: "fadeIn",
      hoverTransform: "scale(1.05)",
      transitionDurationMs: 250,
    });
    expect(css).toContain(motionClassName("w-1"));
    expect(css).toContain("@keyframes");
    expect(css).toContain("fadeIn");
    expect(css).toContain(":hover");
    expect(css).toContain("scale(1.05)");
  });

  it("falls back to button content fields", () => {
    const e = resolveWidgetEffects(undefined, {
      entranceAnimation: "slideUp",
      hoverTransform: "translateY(-2px)",
    });
    expect(e.entranceAnimation).toBe("slideUp");
    expect(e.hoverTransform).toBe("translateY(-2px)");
    expect(widgetHasMotion(undefined, { entranceAnimation: "slideUp" })).toBe(true);
  });

  it("reports no motion when empty", () => {
    expect(widgetHasMotion(undefined, {})).toBe(false);
    expect(widgetHasMotion({ entranceAnimation: "none" }, {})).toBe(false);
  });
});

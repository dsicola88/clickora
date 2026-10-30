import { describe, expect, it } from "vitest";
import {
  buildWidgetMotionCss,
  motionClassName,
  resolveWidgetEffects,
  widgetHasMotion,
  widgetNeedsMotionRuntime,
} from "./widget-motion";

describe("widget-motion", () => {
  it("builds entrance + hover css for any widget id", () => {
    const css = buildWidgetMotionCss("w-1", {
      entranceAnimation: "fadeIn",
      entranceTrigger: "load",
      hoverTransform: "scale(1.05)",
      transitionDurationMs: 250,
    });
    expect(css).toContain(motionClassName("w-1"));
    expect(css).toContain("@keyframes");
    expect(css).toContain("fadeIn");
    expect(css).toContain(":hover");
    expect(css).toContain("scale(1.05)");
  });

  it("uses scroll trigger with pb-in-view by default", () => {
    const css = buildWidgetMotionCss("w-2", {
      entranceAnimation: "flipInX",
    });
    expect(css).toContain("pb-ent-scroll");
    expect(css).toContain("pb-in-view");
    expect(css).toContain("flipInX");
  });

  it("includes sticky, continuous and scrolling fx", () => {
    const css = buildWidgetMotionCss("w-3", {
      sticky: true,
      stickyOffsetPx: 24,
      continuousAnimation: "float",
      scrollingEffect: "vertical",
      mouseTilt: true,
    });
    expect(css).toContain("position:sticky");
    expect(css).toContain("top:24px");
    expect(css).toContain("pb-loop");
    expect(css).toContain("pb-fx");
    expect(css).toContain("--pb-tx");
    expect(widgetHasMotion({ sticky: true }, {})).toBe(true);
    expect(widgetNeedsMotionRuntime({ mouseTilt: true }, {})).toBe(true);
  });

  it("falls back to button content fields", () => {
    const e = resolveWidgetEffects(undefined, {
      entranceAnimation: "slideUp",
      hoverTransform: "translateY(-2px)",
    });
    expect(e.entranceAnimation).toBe("slideUp");
    expect(e.hoverTransform).toBe("translateY(-2px)");
    expect(e.entranceTrigger).toBe("scroll");
    expect(widgetHasMotion(undefined, { entranceAnimation: "slideUp" })).toBe(true);
  });

  it("reports no motion when empty", () => {
    expect(widgetHasMotion(undefined, {})).toBe(false);
    expect(widgetHasMotion({ entranceAnimation: "none" }, {})).toBe(false);
    expect(widgetNeedsMotionRuntime({ entranceAnimation: "none" }, {})).toBe(false);
  });
});

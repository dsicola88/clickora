import { describe, expect, it } from "vitest";
import { createDefaultSalesLandingDocument } from "./salesLandingBuilderDoc";
import { widgetHasMotion, widgetNeedsMotionRuntime } from "@/page-builder/widget-motion";

describe("createDefaultSalesLandingDocument", () => {
  it("ships Pro motion effects on hero and CTAs", () => {
    const doc = createDefaultSalesLandingDocument();
    const widgets = doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets));
    const withMotion = widgets.filter((w) => widgetHasMotion(w.effects, w.content));
    expect(withMotion.length).toBeGreaterThanOrEqual(4);
    /** Marca / 1.º fold: trigger `load` (CSS only); secções abaixo: `scroll` (runtime). */
    const brandHeading = widgets.find((w) => w.type === "heading");
    expect(brandHeading?.effects?.entranceTrigger).toBe("load");
    expect(widgetHasMotion(brandHeading?.effects, brandHeading?.content)).toBe(true);
    const scrollMotion = widgets.filter((w) => w.effects?.entranceTrigger === "scroll");
    expect(scrollMotion.length).toBeGreaterThanOrEqual(2);
    expect(widgetNeedsMotionRuntime(scrollMotion[0]?.effects, scrollMotion[0]?.content)).toBe(true);
  });
});

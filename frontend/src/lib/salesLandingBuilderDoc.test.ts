import { describe, expect, it } from "vitest";
import { createDefaultSalesLandingDocument } from "./salesLandingBuilderDoc";
import { widgetHasMotion, widgetNeedsMotionRuntime } from "@/page-builder/widget-motion";

describe("createDefaultSalesLandingDocument", () => {
  it("ships Pro motion effects on hero and CTAs", () => {
    const doc = createDefaultSalesLandingDocument();
    const widgets = doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets));
    const withMotion = widgets.filter((w) => widgetHasMotion(w.effects, w.content));
    expect(withMotion.length).toBeGreaterThanOrEqual(4);
    const heroHeading = widgets.find((w) => w.type === "heading");
    expect(heroHeading?.effects?.entranceTrigger).toBe("scroll");
    expect(widgetNeedsMotionRuntime(heroHeading?.effects, heroHeading?.content)).toBe(true);
  });
});

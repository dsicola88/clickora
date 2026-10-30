import { describe, expect, it } from "vitest";
import { coerceSalesLandingPromos, DEFAULT_SALES_LANDING_PROMOS } from "./salesLandingPromos";

describe("salesLandingPromos", () => {
  it("returns enterprise defaults", () => {
    const p = coerceSalesLandingPromos(undefined);
    expect(p.sticky_bar.enabled).toBe(true);
    expect(p.popups.length).toBeGreaterThan(0);
    expect(p.popups.some((x) => x.trigger === "exit_intent")).toBe(true);
  });

  it("preserves admin edits", () => {
    const p = coerceSalesLandingPromos({
      sticky_bar: { ...DEFAULT_SALES_LANDING_PROMOS.sticky_bar, enabled: false, text: "Promo X" },
      popups: [
        {
          ...DEFAULT_SALES_LANDING_PROMOS.popups[0],
          id: "custom",
          discount_code: "SAVE20",
          enabled: true,
        },
      ],
    });
    expect(p.sticky_bar.enabled).toBe(false);
    expect(p.sticky_bar.text).toBe("Promo X");
    expect(p.popups[0].discount_code).toBe("SAVE20");
  });
});

import { describe, expect, it } from "vitest";
import {
  resolveCookieBannerVisual,
  setCookieResponsiveLayout,
  setCookieResponsiveNumber,
} from "./cookieBannerStyle";

describe("cookieBannerStyle", () => {
  it("defaults to professional non-pill buttons and stacks on mobile", () => {
    const desktop = resolveCookieBannerVisual({}, "desktop", "modal");
    expect(desktop.buttonRadius).toBe(10);
    expect(desktop.layout).toBe("row");
    expect(desktop.allowBg).toBe("#0f172a");
    expect(desktop.maxWidthPx).toBe(420);

    const mobile = resolveCookieBannerVisual(
      {
        buttonLayout: { desktop: "row", tablet: "row", mobile: "stack" },
        maxWidthPx: { desktop: 420, mobile: 340 },
      },
      "mobile",
      "modal",
    );
    expect(mobile.layout).toBe("stack");
    expect(mobile.maxWidthPx).toBe(340);
    expect(mobile.allowStyle.width).toBe("100%");
  });

  it("nunca deixa tablet/mobile mais largos que desktop", () => {
    const tablet = resolveCookieBannerVisual(
      { maxWidthPx: { desktop: 400, tablet: 520, mobile: 600 } },
      "tablet",
      "modal",
    );
    const mobile = resolveCookieBannerVisual(
      { maxWidthPx: { desktop: 400, tablet: 520, mobile: 600 } },
      "mobile",
      "modal",
    );
    expect(tablet.maxWidthPx).toBe(400);
    expect(mobile.maxWidthPx).toBe(400);
  });

  it("keeps legacy accentColor as allow background", () => {
    const v = resolveCookieBannerVisual({ accentColor: "#16a34a" }, "desktop", "modal");
    expect(v.allowBg).toBe("#16a34a");
    expect(v.allowStyle.background).toBe("#16a34a");
  });

  it("writes responsive patches per device", () => {
    const width = setCookieResponsiveNumber(420, "mobile", 320, 420);
    expect(width).toEqual({ desktop: 420, mobile: 320 });
    const layout = setCookieResponsiveLayout({ desktop: "row" }, "tablet", "stack");
    expect(layout.desktop).toBe("row");
    expect(layout.tablet).toBe("stack");
  });
});

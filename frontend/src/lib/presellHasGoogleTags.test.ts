import { describe, expect, it } from "vitest";
import { presellHasConfiguredGoogleTags } from "./presellHasGoogleTags";

describe("presellHasConfiguredGoogleTags", () => {
  it("false sem qualquer Google", () => {
    expect(presellHasConfiguredGoogleTags({ settings: { fbPixelId: "123" } })).toBe(false);
  });

  it("true com AW / G- / GTM no campo", () => {
    expect(presellHasConfiguredGoogleTags({ settings: { googleTrackingCode: "AW-123" } })).toBe(true);
    expect(presellHasConfiguredGoogleTags({ settings: { googleTrackingCode: "G-ABC" } })).toBe(true);
    expect(presellHasConfiguredGoogleTags({ settings: { googleTrackingCode: "GTM-XYZ" } })).toBe(true);
  });

  it("true com snippet gtag colado", () => {
    expect(
      presellHasConfiguredGoogleTags({
        headerCode: '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>',
      }),
    ).toBe(true);
  });

  it("true com builder gtm/ga4", () => {
    expect(presellHasConfiguredGoogleTags({ builderTracking: { gtmId: "GTM-1" } })).toBe(true);
    expect(presellHasConfiguredGoogleTags({ builderTracking: { ga4Id: "G-1" } })).toBe(true);
  });
});

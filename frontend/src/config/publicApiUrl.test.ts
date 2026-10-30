import { describe, expect, it } from "vitest";
import {
  getTrackApiBaseForAccountDomains,
  getTrackApiBaseForPublicPresell,
  normalizeToApiBaseUrl,
  resolveTrackApiBaseForExport,
} from "./publicApiUrl";

describe("getTrackApiBaseForPublicPresell", () => {
  it("uses presell host for absolute track base", () => {
    expect(
      getTrackApiBaseForPublicPresell(
        "https://bestbuyhere.sbs/p/84ceef7a-0257-4890-b155-314348347d36",
      ),
    ).toBe("https://bestbuyhere.sbs/api");
  });
});

describe("getTrackApiBaseForAccountDomains", () => {
  it("prefers default tracking host", () => {
    expect(
      getTrackApiBaseForAccountDomains([
        { hostname: "www.marca.com", status: "verified", purpose: "hosting" },
        { hostname: "go.marca.com", status: "verified", purpose: "tracking", is_default_tracking: true },
        { hostname: "clk.marca.com", status: "verified", purpose: "both" },
      ]),
    ).toBe("https://go.marca.com/api");
  });

  it("returns null when no tracking-capable verified domain", () => {
    expect(
      getTrackApiBaseForAccountDomains([
        { hostname: "www.marca.com", status: "verified", purpose: "hosting" },
        { hostname: "go.marca.com", status: "pending", purpose: "tracking" },
      ]),
    ).toBeNull();
  });
});

describe("resolveTrackApiBaseForExport", () => {
  it("falls back to public presell host", () => {
    expect(
      resolveTrackApiBaseForExport([], "https://lander.example/p/abc"),
    ).toBe("https://lander.example/api");
  });
});

describe("normalizeToApiBaseUrl", () => {
  it("appends /api to origin", () => {
    expect(normalizeToApiBaseUrl("https://example.com")).toBe("https://example.com/api");
  });
});

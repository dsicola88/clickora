import { describe, expect, it } from "vitest";
import {
  getLanderApiBaseForAccountDomains,
  getTrackApiBaseForAccountDomains,
  getTrackApiBaseForPublicPresell,
  normalizeToApiBaseUrl,
  resolveTrackApiBaseForExport,
  resolveTrackApiBaseForPanelEmbed,
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

  it("prefers purpose=tracking over both when no default", () => {
    expect(
      getTrackApiBaseForAccountDomains([
        { hostname: "clk.marca.com", status: "verified", purpose: "both", is_default: true },
        { hostname: "go.marca.com", status: "verified", purpose: "tracking" },
      ]),
    ).toBe("https://go.marca.com/api");
  });
});

describe("resolveTrackApiBaseForExport", () => {
  it("falls back to public presell host", () => {
    expect(
      resolveTrackApiBaseForExport([], "https://lander.example/p/abc"),
    ).toBe("https://lander.example/api");
  });

  it("prefers account tracking over lander host", () => {
    expect(
      resolveTrackApiBaseForExport(
        [{ hostname: "go.marca.com", status: "verified", purpose: "tracking", is_default_tracking: true }],
        "https://lander.example/p/abc",
      ),
    ).toBe("https://go.marca.com/api");
  });
});

describe("resolveTrackApiBaseForPanelEmbed", () => {
  it("uses lander hosting when no tracking domain", () => {
    expect(
      resolveTrackApiBaseForPanelEmbed([
        { hostname: "www.marca.com", status: "verified", purpose: "hosting", is_default: true },
      ]),
    ).toBe("https://www.marca.com/api");
  });

  it("uses account tracking when present", () => {
    expect(
      resolveTrackApiBaseForPanelEmbed(
        [
          { hostname: "www.marca.com", status: "verified", purpose: "hosting", is_default: true },
          { hostname: "go.marca.com", status: "verified", purpose: "tracking", is_default_tracking: true },
        ],
        "https://www.marca.com/p/x",
      ),
    ).toBe("https://go.marca.com/api");
  });
});

describe("getLanderApiBaseForAccountDomains", () => {
  it("ignores tracking-only domains", () => {
    expect(
      getLanderApiBaseForAccountDomains([
        { hostname: "go.marca.com", status: "verified", purpose: "tracking" },
        { hostname: "www.marca.com", status: "verified", purpose: "hosting", is_default: true },
      ]),
    ).toBe("https://www.marca.com/api");
  });
});

describe("normalizeToApiBaseUrl", () => {
  it("appends /api to origin", () => {
    expect(normalizeToApiBaseUrl("https://example.com")).toBe("https://example.com/api");
  });
});

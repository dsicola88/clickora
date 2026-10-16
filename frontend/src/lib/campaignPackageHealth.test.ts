import { describe, expect, it } from "vitest";
import { campaignPackageHealth } from "./campaignPackageHealth";
import type { AdBundle } from "@/services/keywordResearchService";

const minimalBundle = (): AdBundle => ({
  source: "deterministic",
  locale: "en-US",
  platform: "google",
  objective: "purchase",
  headlines: [
    { id: "h1", text: "Buy Example Product", pin: null },
    { id: "h2", text: "Official Site Today", pin: null },
    { id: "h3", text: "Order Online Now", pin: null },
  ],
  descriptions: [
    { id: "d1", text: "See Example Product and continue to the page for this offer.", pin: null },
    { id: "d2", text: "Order Example Product online and review the page before you buy.", pin: null },
  ],
  path1: "example",
  path2: "",
  sitelinks: [
    { id: "s1", text: "Product details", url: "https://example.com", description1: "Open page.", description2: "Review there." },
    { id: "s2", text: "Current offer", url: "https://example.com", description1: "See offer.", description2: "Continue." },
    { id: "s3", text: "Compare options", url: "https://example.com", description1: "Side by side.", description2: "Decide." },
    { id: "s4", text: "See pricing", url: "https://example.com", description1: "Check price.", description2: "On site." },
  ],
  callouts: [
    { id: "c1", text: "Free shipping" },
    { id: "c2", text: "Secure checkout" },
  ],
  snippet: null,
  promotion: null,
  businessName: "Example Product",
  limitations: [],
});

describe("campaignPackageHealth", () => {
  it("marca pacote mínimo válido como OK", () => {
    const rows = campaignPackageHealth(minimalBundle(), []);
    expect(rows.find((r) => r.id === "headlines")?.ok).toBe(true);
    expect(rows.find((r) => r.id === "export")?.ok).toBe(true);
  });

  it("deteta título longo", () => {
    const bundle = minimalBundle();
    bundle.headlines[0] = { ...bundle.headlines[0], text: "This headline is definitely too long for RSA" };
    const rows = campaignPackageHealth(bundle, []);
    expect(rows.find((r) => r.id === "headlines")?.ok).toBe(false);
  });
});

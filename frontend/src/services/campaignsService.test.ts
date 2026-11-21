import { describe, expect, it } from "vitest";
import { buildGoogleAdsPresellUrlParts } from "@/lib/googleAdsPresellUrl";
import { buildTrackedPresellUrl, campaignUtmSlug } from "./campaignsService";

describe("buildGoogleAdsPresellUrlParts", () => {
  it("separa lander e sufixo Google", () => {
    const base = "https://lander.example/p/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const { finalUrl, finalUrlSuffix } = buildGoogleAdsPresellUrlParts(base, "Melara DE Test", "Google Ads");
    expect(finalUrl).toBe(base);
    expect(finalUrlSuffix).toContain("utm_term={keyword}");
    expect(finalUrlSuffix.startsWith("?")).toBe(false);
  });
});

describe("buildTrackedPresellUrl", () => {
  it("não injecta gclid/wbraid (auto-tagging Google)", () => {
    const url = buildTrackedPresellUrl(
      "https://lander.example/p/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      "Melara DE Test",
      "Google Ads",
    );
    const u = new URL(url);
    expect(u.searchParams.has("gclid")).toBe(false);
    expect(u.searchParams.has("gbraid")).toBe(false);
    expect(u.searchParams.has("wbraid")).toBe(false);
    expect(u.searchParams.get("utm_medium")).toBe("cpc");
    expect(u.searchParams.get("utm_source")).toBe("google_ads");
    expect(u.searchParams.get("utm_campaign")).toBe(campaignUtmSlug("Melara DE Test"));
    expect(u.searchParams.get("utm_term")).toBe("{keyword}");
    expect(u.searchParams.get("utm_content")).toBe("{adgroupid}");
    expect(url).not.toMatch(/%7Bkeyword%7D/i);
  });
});

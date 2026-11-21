import { describe, expect, it } from "vitest";
import {
  buildGoogleAdsPresellUrlParts,
  cleanPresellUrlForGoogleFinalBase,
  campaignUtmSlug,
  presellAdsCampaignName,
} from "./googleAdsPresellUrl";

describe("googleAdsPresellUrl", () => {
  const base = "https://truefindlab.blog/p/c516c2c8-ff36-493e-ba07-dc747d8e4dea";

  it("final URL sem query", () => {
    expect(cleanPresellUrlForGoogleFinalBase(`${base}?utm_source=x&gclid=1`)).toBe(base);
  });

  it("separa Final URL e sufixo para Google", () => {
    const { finalUrl, finalUrlSuffix, combinedTrackingUrl } = buildGoogleAdsPresellUrlParts(
      base,
      "Visivra Fast",
      "Google Ads",
    );
    expect(finalUrl).toBe(base);
    expect(finalUrlSuffix).not.toMatch(/^\?/);
    expect(finalUrlSuffix).toContain("utm_source=google_ads");
    expect(finalUrlSuffix).toContain("utm_term={keyword}");
    expect(finalUrlSuffix).toContain("utm_campaign=" + campaignUtmSlug("Visivra Fast"));
    expect(combinedTrackingUrl).toBe(`${base}?${finalUrlSuffix}`);
  });

  it("não coloca gclid no sufixo", () => {
    const { finalUrlSuffix } = buildGoogleAdsPresellUrlParts(base, "x", "Google Ads");
    expect(finalUrlSuffix).not.toMatch(/gclid/i);
  });

  it("URL do rotador sem query na Final URL", () => {
    const rotator = "https://app.example.com/r/visivra-ab";
    const { finalUrl, finalUrlSuffix } = buildGoogleAdsPresellUrlParts(rotator, "VISIVRA AB", "Google Ads");
    expect(finalUrl).toBe(rotator);
    expect(finalUrlSuffix).toContain("utm_campaign=");
  });

  it("presellAdsCampaignName prefere título", () => {
    expect(presellAdsCampaignName("Visivra", "slug-x")).toBe("Visivra");
    expect(presellAdsCampaignName("", "slug-x")).toBe("slug-x");
  });
});
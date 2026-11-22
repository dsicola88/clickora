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

  it("modo simples (combined) alinhado Google — sem click IDs, macros ValueTrack intactas", () => {
    const polluted = `${base}?gclid=bad&gbraid=x&gad_source=1&gad_campaignid=99&utm_source=keep`;
    const parts = buildGoogleAdsPresellUrlParts(polluted, "Offer DE", "Google Ads");
    expect(parts.finalUrl).toBe(base);
    expect(parts.finalUrl).not.toMatch(/[?#]/);
    expect(parts.finalUrlSuffix).not.toMatch(/gclid|gbraid|wbraid|gad_source|gad_campaignid/i);
    expect(parts.finalUrlSuffix).toContain("utm_term={keyword}");
    expect(parts.finalUrlSuffix).toContain("utm_content={adgroupid}");
    expect(parts.combinedTrackingUrl).toBe(`${parts.finalUrl}?${parts.finalUrlSuffix}`);
    expect(parts.combinedTrackingUrl).not.toMatch(/gclid|gad_source/i);
    const u = new URL(parts.combinedTrackingUrl);
    expect(u.searchParams.get("utm_source")).toBe("keep");
  });

  it("sufixo sem ? inicial (campo Google)", () => {
    const { finalUrlSuffix } = buildGoogleAdsPresellUrlParts(base, "x", "Google Ads");
    expect(finalUrlSuffix.startsWith("?")).toBe(false);
    expect(finalUrlSuffix.startsWith("&")).toBe(false);
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
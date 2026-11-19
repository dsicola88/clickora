import { describe, expect, it } from "vitest";
import {
  buildMediaBuyerQaPresellUrl,
  computePresellTrackingHealth,
  PRESELL_QA_UTM,
} from "./presellTrackingHealth";
import { DEFAULT_PRESELL_CONFIG_SETTINGS } from "./presellConfigDefaults";

describe("buildMediaBuyerQaPresellUrl", () => {
  it("anexa gad_source e gclid de QA sem ??", () => {
    const out = buildMediaBuyerQaPresellUrl("https://offer.example/p/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(out).toBeTruthy();
    const u = new URL(out!);
    expect(u.searchParams.get("gad_source")).toBe("1");
    expect(u.searchParams.get("gclid")).toBe("clickora_qa_test_click");
    expect(u.searchParams.get("utm_source")).toBe("clickora_qa");
    expect(out!.includes("??")).toBe(false);
  });

  it("não sobrescreve gclid já na URL", () => {
    const out = buildMediaBuyerQaPresellUrl(
      "https://offer.example/p/x?gclid=already_from_ads&utm_source=google",
    );
    const u = new URL(out!);
    expect(u.searchParams.get("gclid")).toBe("already_from_ads");
    expect(u.searchParams.get("utm_source")).toBe("google");
    expect(u.searchParams.get("gad_source")).toBe("1");
  });

  it("PRESELL_QA_UTM inclui sinais Google Ads", () => {
    expect(PRESELL_QA_UTM).toContain("gad_source=1");
    expect(PRESELL_QA_UTM).toContain("gclid=clickora_qa_test_click");
  });
});

describe("computePresellTrackingHealth", () => {
  it("avisa se falta hoplink (afiliado não vende)", () => {
    const { items } = computePresellTrackingHealth({
      configSettings: { ...DEFAULT_PRESELL_CONFIG_SETTINGS },
      hasTrackingEmbedScript: true,
      affiliateLinkTrimmed: "",
      hasPublishedPageId: true,
    });
    const offer = items.find((i) => i.id === "offer");
    expect(offer?.status).toBe("warn");
  });

  it("inclui passo URL final Google Ads", () => {
    const { items } = computePresellTrackingHealth({
      configSettings: { ...DEFAULT_PRESELL_CONFIG_SETTINGS },
      hasTrackingEmbedScript: true,
      affiliateLinkTrimmed: "https://network.example/offer",
      hasPublishedPageId: true,
    });
    expect(items.some((i) => i.id === "e2e-final-url")).toBe(true);
  });
});

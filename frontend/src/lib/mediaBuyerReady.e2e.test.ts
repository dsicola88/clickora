/**
 * E2E fechável em CI: evidência → Situação → lista Google Ads + checklist media buyer.
 */
import { describe, expect, it } from "vitest";
import { resolveClickVisitorQuality } from "./clickVisitorQuality";
import {
  collectDatacenterIpsForGoogleAdsExclusion,
  formatGoogleAdsIpExclusionList,
} from "./googleAdsIpExclusion";
import { MEDIA_BUYER_E2E_CHECKLIST } from "./mediaBuyerE2eChecklist";
import { computePresellTrackingHealth } from "./presellTrackingHealth";
import { DEFAULT_PRESELL_CONFIG_SETTINGS } from "./presellConfigDefaults";

describe("E2E media buyer ready (fechável em código)", () => {
  it("pipeline Visivra-like: API datacenter → label → exclusão Google", () => {
    const apiRows = [
      {
        ip_address: "18.144.100.168",
        is_bot: false,
        unqualified: true,
        ip_network: "AWS",
        unqualified_reason: "Rede AWS (us-west-1).",
      },
      {
        ip_address: "203.0.113.50",
        is_bot: false,
        unqualified: false,
        ip_network: null,
      },
    ];
    const ui = apiRows.map((e) => {
      const q = resolveClickVisitorQuality(e);
      return { ip: e.ip_address || "—", statusKind: q.kind, status: q.label };
    });
    expect(ui[0]?.status).toBe("Datacenter (AWS)");
    expect(ui[1]?.status).toBe("Real");
    const exclusion = collectDatacenterIpsForGoogleAdsExclusion(ui);
    expect(exclusion).toEqual(["18.144.100.168"]);
    expect(formatGoogleAdsIpExclusionList(exclusion)).toBe("18.144.100.168");
  });

  it("checklist media buyer tem 5 passos com postback e smoke", () => {
    expect(MEDIA_BUYER_E2E_CHECKLIST.length).toBeGreaterThanOrEqual(5);
    expect(MEDIA_BUYER_E2E_CHECKLIST.some((s) => s.id === "postback")).toBe(true);
    expect(MEDIA_BUYER_E2E_CHECKLIST.some((s) => s.id === "smoke")).toBe(true);
    expect(MEDIA_BUYER_E2E_CHECKLIST.some((s) => s.id === "ivt")).toBe(true);
  });

  it("saúde da presell inclui passos E2E sem inventar pixels", () => {
    const { items, readyScore } = computePresellTrackingHealth({
      configSettings: { ...DEFAULT_PRESELL_CONFIG_SETTINGS },
      hasTrackingEmbedScript: true,
      affiliateLinkTrimmed: "https://example.com/offer",
      hasPublishedPageId: true,
    });
    expect(readyScore).toBeGreaterThan(50);
    expect(items.some((i) => i.id === "e2e-postback")).toBe(true);
    expect(items.some((i) => i.id === "e2e-smoke")).toBe(true);
    expect(items.find((i) => i.id === "networks")?.status).toBe("info");
  });
});

import { describe, expect, it } from "vitest";
import {
  DPILOT_LANDING_QUERY,
  dpilotAdsHandoffHref,
  dpilotGoogleCampaignHref,
  parseDpilotLandingQuery,
} from "./dpilotPresellHandoff";

describe("dpilotPresellHandoff", () => {
  it("aceita só http(s) absoluto e mantém macros ValueTrack", () => {
    expect(parseDpilotLandingQuery("landing=https://www.dclickora.com/p/abc")).toContain(
      "https://www.dclickora.com/p/abc",
    );
    const encoded = new URLSearchParams({
      landing: "https://www.dclickora.com/p/abc?gclid={gclid}&utm_term={keyword}",
    }).toString();
    expect(parseDpilotLandingQuery(encoded)).toBe(
      "https://www.dclickora.com/p/abc?gclid={gclid}&utm_term={keyword}",
    );
    expect(parseDpilotLandingQuery("landing=/p/abc")).toBe("");
    expect(parseDpilotLandingQuery("landing=javascript:alert(1)")).toBe("");
  });

  it("monta o salto da presell para o assistente", () => {
    const href = dpilotAdsHandoffHref("https://www.dclickora.com/p/x");
    expect(href.startsWith("/tracking/dpilot?")).toBe(true);
    expect(href).toContain(`${DPILOT_LANDING_QUERY}=`);
    expect(dpilotGoogleCampaignHref("11111111-1111-4111-8111-111111111111", "https://www.dclickora.com/p/x")).toContain(
      "/campanhas/nova?",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  DPILOT_LANDING_QUERY,
  dpilotAdsHandoffHref,
  dpilotGoogleCampaignHref,
  parseDpilotLandingQuery,
  sanitizeLandingUrlForAdsFinal,
} from "./dpilotPresellHandoff";

describe("dpilotPresellHandoff", () => {
  it("sanitize remove ValueTrack da Final URL e mantém UTMs estáticos", () => {
    expect(
      sanitizeLandingUrlForAdsFinal(
        "https://www.marca.com/p/abc?utm_source=Google_Ads&utm_campaign=oferta&utm_term={keyword}&gclid={gclid}",
      ),
    ).toBe("https://www.marca.com/p/abc?utm_source=Google_Ads&utm_campaign=oferta");
  });

  it("aceita só http(s) absoluto e limpa macros ValueTrack no handoff", () => {
    expect(parseDpilotLandingQuery("landing=https://www.dclickora.com/p/abc")).toContain(
      "https://www.dclickora.com/p/abc",
    );
    const encoded = new URLSearchParams({
      landing: "https://www.dclickora.com/p/abc?gclid={gclid}&utm_term={keyword}&utm_campaign=x",
    }).toString();
    expect(parseDpilotLandingQuery(encoded)).toBe(
      "https://www.dclickora.com/p/abc?utm_campaign=x",
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

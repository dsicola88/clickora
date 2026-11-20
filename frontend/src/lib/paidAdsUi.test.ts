import { describe, expect, it } from "vitest";

import {
  changeRequestCampaignIdFromPayload,
  describeStudioChangeRequestStatus,
  effectiveCampaignServingStatus,
  googleBiddingStrategyLabel,
  publishedBidStrategyHint,
  summarizeChangeRequestPayload,
} from "./paidAdsUi";

describe("googleBiddingStrategyLabel", () => {
  it("traduz códigos Google para rótulo humano", () => {
    expect(googleBiddingStrategyLabel("maximize_conversions")).toBe("Maximizar conversões");
    expect(googleBiddingStrategyLabel("manual_cpc")).toBe("CPC manual");
    expect(googleBiddingStrategyLabel("")).toBe("");
  });
});

describe("describeStudioChangeRequestStatus", () => {
  it("distingue aplicado, pendente e falha", () => {
    expect(describeStudioChangeRequestStatus("applied").kind).toBe("applied");
    expect(describeStudioChangeRequestStatus("pending").kind).toBe("pending");
    expect(describeStudioChangeRequestStatus("failed").kind).toBe("failed");
    expect(describeStudioChangeRequestStatus("pending").message).toMatch(/Aprovações/);
  });
});

describe("changeRequestCampaignIdFromPayload", () => {
  it("lê campaign_id string do payload", () => {
    expect(changeRequestCampaignIdFromPayload({ campaign_id: "abc-123" })).toBe("abc-123");
  });

  it("devolve null sem campaign_id válido", () => {
    expect(changeRequestCampaignIdFromPayload(null)).toBeNull();
    expect(changeRequestCampaignIdFromPayload({})).toBeNull();
    expect(changeRequestCampaignIdFromPayload({ campaign_id: 1 })).toBeNull();
  });
});

describe("effectiveCampaignServingStatus", () => {
  it("prefere ENABLED/PAUSED da Google ao status local", () => {
    expect(
      effectiveCampaignServingStatus({ local_status: "paused", google_status: "ENABLED" }),
    ).toBe("live");
    expect(
      effectiveCampaignServingStatus({ local_status: "live", google_status: "PAUSED" }),
    ).toBe("paused");
    expect(
      effectiveCampaignServingStatus({ local_status: "live", google_status: "SUSPENDED" }),
    ).toBe("paused");
  });

  it("cai para local quando google_status é null ou desconhecido", () => {
    expect(effectiveCampaignServingStatus({ local_status: "draft", google_status: null })).toBe(
      "draft",
    );
    expect(effectiveCampaignServingStatus({ local_status: "live", google_status: "" })).toBe("live");
    expect(
      effectiveCampaignServingStatus({ local_status: "paused", google_status: "UNKNOWN" }),
    ).toBe("paused");
  });

  it("mapeia REMOVED para archived", () => {
    expect(
      effectiveCampaignServingStatus({ local_status: "live", google_status: "REMOVED" }),
    ).toBe("archived");
  });
});

describe("summarizeChangeRequestPayload", () => {
  it("inclui modo, auto_applied e nota de licitação para Google", () => {
    const { lines } = summarizeChangeRequestPayload(
      {
        mode: "autopilot",
        auto_applied: false,
        landing_url: "https://example.com/x",
        daily_budget_micros: 15_000_000,
        geo_targets: ["PT"],
      },
      { changeRequestType: "create_campaign" },
    );
    expect(lines.some((l) => /Modo no momento do plano: Autopilot/.test(l))).toBe(true);
    expect(lines.some((l) => /Primeira tentativa: não aplicado/.test(l))).toBe(true);
    expect(lines.some((l) => /Google Ads \(Search\).*leilão/i.test(l))).toBe(true);
  });

  it("mostra estratégia Google quando bidding_config existe", () => {
    const { lines } = summarizeChangeRequestPayload(
      {
        bidding_config: {
          google: { strategy: "maximize_conversions" },
        },
      },
      { changeRequestType: "create_campaign" },
    );
    expect(lines.some((l) => /Maximizar conversões/i.test(l))).toBe(true);
    expect(lines.some((l) => /Google Ads \(Search\)/i.test(l))).toBe(false);
  });
});

describe("publishedBidStrategyHint", () => {
  it("devolve null para tipos sem plano de rede", () => {
    expect(publishedBidStrategyHint("update_campaign_budget")).toBeNull();
  });
});

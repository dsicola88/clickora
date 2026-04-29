import { describe, expect, it } from "vitest";

import { publishedBidStrategyHint, summarizeChangeRequestPayload } from "./paidAdsUi";

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

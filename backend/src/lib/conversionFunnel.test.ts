import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertFunnelInvariants,
  buildFunnelStages,
  dayKey,
  type ConversionFunnelResult,
} from "./conversionFunnel";
import { hasPaidNetworkClickId, resolveTrafficType } from "./networkClickId";

function emptyFunnel(over: Partial<ConversionFunnelResult> = {}): ConversionFunnelResult {
  const stages = buildFunnelStages({
    impressions: 0,
    clicks: 0,
    checkouts: 0,
    sales: 0,
  });
  return {
    period: { from: "2026-01-01", to: "2026-01-31", timezone: "UTC" },
    filter: { keyword: null },
    stages,
    series: [],
    traffic: {
      paid_sales: 0,
      paid_untracked_sales: 0,
      organic_sales: 0,
      paid_revenue: 0,
      paid_untracked_revenue: 0,
      organic_revenue: 0,
      paid_pct: null,
      paid_untracked_pct: null,
      organic_pct: null,
    },
    roi: {
      spend: null,
      spend_source: "none",
      spend_currency: null,
      revenue: 0,
      profit: null,
      roi_pct: null,
      roas: null,
      cpa: null,
      epc: null,
      conversion_rate: 0,
    },
    alerts: [],
    keywords: [],
    definitions: {
      impressions: "",
      clicks: "",
      checkouts: "",
      sales: "",
      paid: "",
      paid_untracked: "",
      organic: "",
      kpi_noise: "",
    },
    ...over,
  };
}

describe("buildFunnelStages", () => {
  it("calcula taxas face ao topo e à etapa anterior", () => {
    const stages = buildFunnelStages({
      impressions: 1000,
      clicks: 100,
      checkouts: 40,
      sales: 10,
    });
    assert.equal(stages.length, 4);
    assert.equal(stages[0]!.id, "impressions");
    assert.equal(stages[0]!.count, 1000);
    assert.equal(stages[0]!.rate_from_previous, null);
    assert.equal(stages[0]!.rate_from_top, 100);

    assert.equal(stages[1]!.count, 100);
    assert.equal(stages[1]!.rate_from_previous, 10);
    assert.equal(stages[1]!.rate_from_top, 10);

    assert.equal(stages[2]!.count, 40);
    assert.equal(stages[2]!.rate_from_previous, 40);
    assert.equal(stages[2]!.rate_from_top, 4);

    assert.equal(stages[3]!.count, 10);
    assert.equal(stages[3]!.rate_from_previous, 25);
    assert.equal(stages[3]!.rate_from_top, 1);
  });

  it("usa cliques como topo quando não há impressões", () => {
    const stages = buildFunnelStages({
      impressions: 0,
      clicks: 50,
      checkouts: 10,
      sales: 5,
    });
    assert.equal(stages[0]!.rate_from_top, 0);
    assert.equal(stages[1]!.rate_from_top, 100);
    assert.equal(stages[3]!.rate_from_top, 10);
  });

  it("devolve taxas null quando não há volume", () => {
    const stages = buildFunnelStages({
      impressions: 0,
      clicks: 0,
      checkouts: 0,
      sales: 0,
    });
    for (const s of stages) {
      assert.equal(s.rate_from_top, null);
      if (s.id === "impressions") assert.equal(s.rate_from_previous, null);
      else assert.equal(s.rate_from_previous, null);
    }
  });

  it("não inventa percentagens com denominador zero na etapa anterior", () => {
    const stages = buildFunnelStages({
      impressions: 10,
      clicks: 0,
      checkouts: 2,
      sales: 1,
    });
    assert.equal(stages[2]!.rate_from_previous, null);
    assert.equal(stages[2]!.rate_from_top, 20);
  });
});

describe("dayKey", () => {
  it("preserva YYYY-MM-DD de strings e Date UTC", () => {
    assert.equal(dayKey("2026-10-30"), "2026-10-30");
    assert.equal(dayKey("2026-10-30T00:00:00.000Z"), "2026-10-30");
    assert.equal(dayKey(new Date(Date.UTC(2026, 9, 30))), "2026-10-30");
  });
});

describe("assertFunnelInvariants", () => {
  it("aceita funil vazio consistente", () => {
    assert.doesNotThrow(() => assertFunnelInvariants(emptyFunnel()));
  });

  it("aceita funil com séries alinhadas ao topo", () => {
    const stages = buildFunnelStages({
      impressions: 10,
      clicks: 5,
      checkouts: 2,
      sales: 2,
    });
    assert.doesNotThrow(() =>
      assertFunnelInvariants(
        emptyFunnel({
          stages,
          series: [
            {
              date: "2026-10-01",
              impressions: 6,
              clicks: 3,
              checkouts: 1,
              sales: 1,
              paid_sales: 1,
              paid_untracked_sales: 0,
              organic_sales: 0,
            },
            {
              date: "2026-10-02",
              impressions: 4,
              clicks: 2,
              checkouts: 1,
              sales: 1,
              paid_sales: 0,
              paid_untracked_sales: 0,
              organic_sales: 1,
            },
          ],
          traffic: {
            paid_sales: 1,
            paid_untracked_sales: 0,
            organic_sales: 1,
            paid_revenue: 10,
            paid_untracked_revenue: 0,
            organic_revenue: 5,
            paid_pct: 50,
            paid_untracked_pct: 0,
            organic_pct: 50,
          },
          roi: {
            spend: null,
            spend_source: "none",
            spend_currency: null,
            revenue: 15,
            profit: null,
            roi_pct: null,
            roas: null,
            cpa: null,
            epc: 3,
            conversion_rate: 40,
          },
        }),
      ),
    );
  });

  it("rejeita vendas != soma pago/ads/orgânico", () => {
    const stages = buildFunnelStages({ impressions: 0, clicks: 1, checkouts: 0, sales: 2 });
    assert.throws(
      () =>
        assertFunnelInvariants(
          emptyFunnel({
            stages,
            series: [
              {
                date: "2026-10-01",
                impressions: 0,
                clicks: 1,
                checkouts: 0,
                sales: 2,
                paid_sales: 2,
                paid_untracked_sales: 0,
                organic_sales: 0,
              },
            ],
            traffic: {
              paid_sales: 1,
              paid_untracked_sales: 0,
              organic_sales: 0,
              paid_revenue: 10,
              paid_untracked_revenue: 0,
              organic_revenue: 0,
              paid_pct: 100,
              paid_untracked_pct: 0,
              organic_pct: 0,
            },
            roi: {
              spend: null,
              spend_source: "none",
              spend_currency: null,
              revenue: 10,
              profit: null,
              roi_pct: null,
              roas: null,
              cpa: null,
              epc: null,
              conversion_rate: 200,
            },
          }),
        ),
      /sales=/,
    );
  });

  it("rejeita filtro keyword com spend persisted da conta", () => {
    assert.throws(
      () =>
        assertFunnelInvariants(
          emptyFunnel({
            filter: { keyword: "emagrecer" },
            roi: {
              spend: 50,
              spend_source: "persisted",
              spend_currency: "USD",
              revenue: 0,
              profit: -50,
              roi_pct: -100,
              roas: 0,
              cpa: null,
              epc: null,
              conversion_rate: 0,
            },
          }),
        ),
      /keyword filter/,
    );
  });
});

describe("contrato paid vs networkClickId", () => {
  it("macros literais nunca são Pago; gclid real é Pago", () => {
    assert.equal(hasPaidNetworkClickId({ gclid: "{gclid}" }), false);
    assert.equal(resolveTrafficType({ gclid: "{gclid}", medium: "cpc" }), "paid_untracked");
    assert.equal(hasPaidNetworkClickId({ gclid: "EAIaIQobChMI_real_click_id" }), true);
    assert.equal(resolveTrafficType({ gclid: "EAIaIQobChMI_real_click_id" }), "paid");
    assert.equal(resolveTrafficType({ source: "newsletter" }), "organic");
  });
});

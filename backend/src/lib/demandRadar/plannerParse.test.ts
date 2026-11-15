import assert from "node:assert/strict";
import test from "node:test";
import {
  finalizePlannerIdeas,
  numFromPlannerProto,
  parseKeywordIdeasResponse,
  rowToPlannerIdea,
} from "./plannerParse";

test("plannerParse lê volume e CPC de proto JSON", () => {
  assert.equal(numFromPlannerProto("5400"), 5400);
  assert.equal(numFromPlannerProto(1200), 1200);
  assert.equal(numFromPlannerProto("1,200"), 1200);

  const idea = rowToPlannerIdea({
    text: "visivra",
    keywordIdeaMetrics: {
      avgMonthlySearches: "5400",
      averageCpcMicros: "1500000",
      competition: "MEDIUM",
    },
  });
  assert.equal(idea?.keyword, "visivra");
  assert.equal(idea?.monthly_volume, 5400);
  assert.equal(idea?.avg_cpc, 1.5);
  assert.equal(idea?.competition, "medium");
  assert.equal(idea?.competition_index, null);
  assert.equal(idea?.bid_low, null);
  assert.equal(idea?.bid_high, null);
  assert.equal(idea?.change_3m_pct, null);
  assert.equal(idea?.change_yoy_pct, null);
});

test("plannerParse usa bid low/high quando averageCpc falta", () => {
  const idea = rowToPlannerIdea({
    text: "buy visivra",
    keywordIdeaMetrics: {
      avgMonthlySearches: 800,
      lowTopOfPageBidMicros: "1000000",
      highTopOfPageBidMicros: "3000000",
      competition: "LOW",
    },
  });
  assert.equal(idea?.avg_cpc, 2);
  assert.equal(idea?.competition, "low");
});

test("plannerParse mantém seed exact fora do top-N e usa-a como primary", () => {
  const ideas = Array.from({ length: 25 }, (_, i) => ({
    keyword: `related ${i}`,
    monthly_volume: 9000 - i,
    avg_cpc: 1,
    bid_low: null as number | null,
    bid_high: null as number | null,
    competition: "high" as const,
    competition_index: 80 as number | null,
    change_3m_pct: null as number | null,
    change_yoy_pct: null as number | null,
    monthly_search_volumes: [],
  }));
  ideas.push({
    keyword: "my product",
    monthly_volume: 100,
    avg_cpc: 0.5,
    bid_low: null,
    bid_high: null,
    competition: "low",
    competition_index: 12 as number | null,
    change_3m_pct: null,
    change_yoy_pct: null,
    monthly_search_volumes: [],
  });
  const out = finalizePlannerIdeas(ideas, "my product", 10);
  assert.equal(out.primary_kind, "exact_seed");
  assert.equal(out.primary?.keyword, "my product");
  assert.equal(out.primary?.monthly_volume, 100);
  assert.equal(out.ideas[0]?.keyword, "my product");
  assert.equal(out.ideas.length, 10);
  assert.ok(out.ideas.some((i) => i.keyword === "my product"));
});

test("plannerParse sem match: primary = top relacionado (não inventa)", () => {
  const out = parseKeywordIdeasResponse(
    {
      results: [
        {
          text: "melatonin gummies",
          keywordIdeaMetrics: {
            avgMonthlySearches: 12000,
            averageCpcMicros: "2000000",
            competition: "HIGH",
          },
        },
        {
          text: "best melatonin",
          keywordIdeaMetrics: {
            avgMonthlySearches: 4000,
            averageCpcMicros: "1800000",
            competition: "MEDIUM",
          },
        },
      ],
    },
    "VisivraMaxXYZ",
    10,
  );
  assert.equal(out.seed_match, null);
  assert.equal(out.primary_kind, "top_related");
  assert.equal(out.primary?.keyword, "melatonin gummies");
  assert.equal(out.primary?.monthly_volume, 12000);
});

test("plannerParse ignora linhas sem volume nem CPC", () => {
  const idea = rowToPlannerIdea({
    text: "empty",
    keywordIdeaMetrics: { avgMonthlySearches: 0, competition: "UNSPECIFIED" },
  });
  assert.equal(idea, null);
});

test("plannerParse extrai histórico mensal oficial", () => {
  const idea = rowToPlannerIdea({
    text: "visivra",
    keywordIdeaMetrics: {
      avgMonthlySearches: 5000,
      averageCpcMicros: "1000000",
      competition: "MEDIUM",
      monthlySearchVolumes: [
        { year: 2025, month: "JANUARY", monthlySearches: "4000" },
        { year: 2025, month: 2, monthlySearches: 4500 },
        { year: 2025, month: "MARCH", monthlySearches: 5200 },
      ],
    },
  });
  assert.equal(idea?.monthly_search_volumes.length, 3);
  assert.deepEqual(idea?.monthly_search_volumes[0], {
    year: 2025,
    month: 1,
    monthly_searches: 4000,
  });
  assert.equal(idea?.monthly_search_volumes[2]?.monthly_searches, 5200);
});

test("plannerParse lê partilha oficial por dispositivo", async () => {
  const { parsePlannerDeviceBreakdown } = await import("./plannerParse");
  const out = parsePlannerDeviceBreakdown({
    aggregateMetricResults: {
      deviceSearches: [
        { device: "DESKTOP", searchCount: "600" },
        { device: "MOBILE", searchCount: "350" },
        { device: "TABLET", searchCount: "50" },
      ],
    },
  });
  assert.ok(out);
  assert.equal(out!.source, "google_ads_keyword_planner");
  assert.equal(out!.items.length, 3);
  assert.equal(out!.items[0]?.device, "desktop");
  assert.equal(out!.items[0]?.search_share, 60);
  assert.equal(out!.items[1]?.device, "mobile");
  assert.equal(out!.items[1]?.search_share, 35);
});

test("plannerParse calcula Δ3m e YoY da série mensal", async () => {
  const { computeVolumeChanges } = await import("./plannerParse");
  const out = computeVolumeChanges([
    { year: 2024, month: 10, monthly_searches: 1000 },
    { year: 2025, month: 7, monthly_searches: 800 },
    { year: 2025, month: 10, monthly_searches: 1200 },
  ]);
  assert.equal(out.change_3m_pct, 50); // 1200 vs 800
  assert.equal(out.change_yoy_pct, 20); // 1200 vs 1000
});

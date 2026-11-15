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
  assert.deepEqual(idea, {
    keyword: "visivra",
    monthly_volume: 5400,
    avg_cpc: 1.5,
    competition: "medium",
    monthly_search_volumes: [],
  });
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
    competition: "high" as const,
    monthly_search_volumes: [],
  }));
  ideas.push({
    keyword: "my product",
    monthly_volume: 100,
    avg_cpc: 0.5,
    competition: "low",
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

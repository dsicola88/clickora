import { describe, expect, it } from "vitest";
import type { KeywordItem } from "@/services/keywordResearchService";
import {
  copyKeywordsText,
  filterKeywords,
  groupNegativeKeywords,
  keywordsToCsv,
  setKeywordSelection,
  toggleKeywordSelection,
} from "./keywordResults";

const items: KeywordItem[] = [
  { keyword: "glucotrust buy", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
  { keyword: "glucotrust review", intent: "COMMERCIAL", relevance: "MEDIUM", negativeSuggestion: false },
  { keyword: "what is glucotrust", intent: "INFORMATIONAL", relevance: "MEDIUM", negativeSuggestion: false },
  { keyword: "glucotrust scam", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true },
];

describe("filterKeywords", () => {
  it("filtra por intenção e pesquisa instantânea", () => {
    expect(filterKeywords(items, "", "ALL")).toHaveLength(4);
    expect(filterKeywords(items, "buy", "ALL").map((k) => k.keyword)).toEqual(["glucotrust buy"]);
    expect(filterKeywords(items, "", "BUY")).toHaveLength(1);
    expect(filterKeywords(items, "glucotrust", "NEGATIVE")).toHaveLength(1);
  });
});

describe("toggleKeywordSelection", () => {
  it("selecciona e desselecciona", () => {
    const one = toggleKeywordSelection(new Set(), "glucotrust buy");
    expect(one.has("glucotrust buy")).toBe(true);
    const none = toggleKeywordSelection(one, "glucotrust buy");
    expect(none.size).toBe(0);
  });
});

describe("copyKeywordsText", () => {
  it("copia uma por linha", () => {
    expect(copyKeywordsText(items.slice(0, 2))).toBe("glucotrust buy\nglucotrust review");
  });
});

describe("groupNegativeKeywords", () => {
  it("agrupa negativas e selecciona o grupo", () => {
    const negatives: KeywordItem[] = [
      { keyword: "notion jobs", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true, negativeGroup: "JOBS" },
      { keyword: "notion login", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true, negativeGroup: "ACCOUNT" },
    ];
    const groups = groupNegativeKeywords(negatives);
    expect(groups.map((g) => g.group)).toEqual(["JOBS", "ACCOUNT"]);
    const selected = setKeywordSelection(new Set(), ["notion jobs"], true);
    expect(selected.has("notion jobs")).toBe(true);
    expect(setKeywordSelection(selected, ["notion jobs"], false).size).toBe(0);
  });
});

describe("keywordsToCsv", () => {
  it("inclui BOM e colunas pedidas sem métricas inventadas", () => {
    const csv = keywordsToCsv(items.slice(0, 1), {
      language: "en",
      market: "US",
      product: "GlucoTrust",
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("keyword,intent,funnel,relevance,theme,match_types,natural,negative_suggestion,negative_group,language,market,product");
    expect(csv).toContain("glucotrust buy,BUY,BOTTOM,HIGH,,,true,false,,en,US,GlucoTrust");
    expect(csv).not.toContain("volume");
    expect(csv).not.toContain("cpc");
  });
});

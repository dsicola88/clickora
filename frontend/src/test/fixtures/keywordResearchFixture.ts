import type { AdBundle, KeywordItem, KeywordResearch } from "@/services/keywordResearchService";

export const fixtureKeywords: KeywordItem[] = [
  { keyword: "buy pv v2 online", intent: "BUY", relevance: "HIGH", negativeSuggestion: false, funnel: "BOTTOM", matchTypes: ["EXACT", "PHRASE"] },
  { keyword: "pv v2 official site", intent: "BRAND", relevance: "HIGH", negativeSuggestion: false, funnel: "BOTTOM", matchTypes: ["PHRASE"] },
  { keyword: "pv v2 price", intent: "COMMERCIAL", relevance: "MEDIUM", negativeSuggestion: false, funnel: "MIDDLE", matchTypes: ["BROAD"] },
  { keyword: "pv v2 careers", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true, negativeGroup: "JOBS", funnel: null },
  { keyword: "free pv v2 download", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true, negativeGroup: "FREE", funnel: null },
];

export const fixtureBundle: AdBundle = {
  source: "deterministic",
  llmFailed: false,
  locale: "en-US",
  platform: "google",
  objective: "purchase",
  limitations: [],
  headlines: [
    { id: "h1", text: "PV V2 Official Site", pin: null },
    { id: "h2", text: "Buy PV V2 Online", pin: null },
    { id: "h3", text: "You Save $200 Today", pin: null },
    { id: "h4", text: "Order PV V2 Now", pin: null },
    { id: "h5", text: "Secure Checkout", pin: null },
    { id: "h6", text: "Limited Time Offer", pin: null },
    { id: "h7", text: "See PV V2 Details", pin: null },
  ],
  descriptions: [
    { id: "d1", text: "Open the PV V2 offer page and review the details before you buy.", pin: null },
    { id: "d2", text: "Order PV V2 online with secure checkout on the official landing page.", pin: null },
    { id: "d3", text: "Compare PV V2 with what you already know, then continue to the offer.", pin: null },
    { id: "d4", text: "You save $200 on this offer. Visit the page for terms that apply today.", pin: null },
  ],
  path1: "pv-v2",
  path2: "offer",
  sitelinks: [
    { id: "s1", text: "Official Site", url: "https://example.com/pv2", description1: "Visit the official page.", description2: "Secure landing page." },
    { id: "s2", text: "Current Offer", url: "https://example.com/pv2", description1: "See today's offer.", description2: "Limited time." },
    { id: "s3", text: "Product Details", url: "https://example.com/pv2", description1: "Full product info.", description2: "Review before buy." },
    { id: "s4", text: "Order Online", url: "https://example.com/pv2", description1: "Fast checkout.", description2: "Start here." },
  ],
  callouts: [{ id: "c1", text: "You save $200!" }],
  snippet: null,
  promotion: null,
  businessName: "PV V2",
  analysis: {
    pageStatus: "fetched",
    affiliatePlatform: "maxweb",
    affiliatePlatformLabel: "MaxWeb",
    funnel: "BOTTOM",
    facts: [{ label: "Preço", value: "You save $200!", status: "confirmed" }],
    missing: ["Garantia / reembolso", "Bónus"],
    adGroups: [
      { name: "Compra", intent: "BUY", hint: "Intenção de compra" },
      { name: "Marca", intent: "BRAND", hint: "Nome do produto" },
    ],
    productAligned: true,
  },
};

export const fixtureResearch: KeywordResearch = {
  id: "fixture-id",
  product: "PV V2",
  language: "en",
  language_label: "English",
  market: "US",
  market_name: "United States",
  product_url: "https://example.com/product",
  url_title: null,
  keywords: fixtureKeywords,
  created_at: "2026-10-16T12:00:00.000Z",
  updated_at: "2026-10-16T12:00:00.000Z",
  final_url: "https://example.com/pv2",
  bundle: fixtureBundle,
  validation: [{ level: "warning", code: "fallback", path: "source", message: "Modelo fixo", platform: "both" }],
};

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeterministicKeywords,
  keywordGenerateInputSchema,
  marketName,
  normalizeKeywordText,
  parseLlmKeywordPayload,
  sanitizeKeywordItems,
} from "./keywordGenerator";
import { generateKeywordsForInput } from "./keywordGeneratorLlm";

describe("normalizeKeywordText", () => {
  it("colapsa espaços e lowercase", () => {
    assert.equal(normalizeKeywordText("  GlucoTrust   Buy  "), "glucotrust buy");
  });
});

describe("sanitizeKeywordItems", () => {
  it("remove duplicados e URLs; uma keyword numa categoria", () => {
    const out = sanitizeKeywordItems([
      { keyword: "GlucoTrust Buy", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
      { keyword: " glucotrust  buy ", intent: "INFORMATIONAL", relevance: "LOW", negativeSuggestion: false },
      { keyword: "https://example.com/x", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
      { keyword: "glucotrust scam", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true },
    ]);
    assert.equal(out.filter((k) => k.keyword === "glucotrust buy").length, 1);
    assert.equal(out.find((k) => k.keyword === "glucotrust buy")?.intent, "BUY");
    assert.ok(!out.some((k) => k.keyword.includes("http")));
    assert.equal(out.find((k) => k.keyword === "glucotrust scam")?.intent, "COMMERCIAL");
    assert.equal(out.find((k) => k.keyword === "glucotrust scam")?.negativeSuggestion, false);
  });

  it("não trata review nem scam como negativa automática; agrupa emprego e download", () => {
    const out = sanitizeKeywordItems([
      { keyword: "notion review", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true },
      { keyword: "notion scam", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true },
      { keyword: "notion careers", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
      { keyword: "free notion download", intent: "COMMERCIAL", relevance: "MEDIUM", negativeSuggestion: false },
      { keyword: "notion login", intent: "BRAND", relevance: "HIGH", negativeSuggestion: false },
      { keyword: "notion wholesale", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true, negativeGroup: "OTHER" },
    ]);
    assert.equal(out.find((k) => k.keyword === "notion review")?.intent, "COMMERCIAL");
    assert.equal(out.find((k) => k.keyword === "notion scam")?.intent, "COMMERCIAL");
    assert.equal(out.find((k) => k.keyword === "notion careers")?.negativeGroup, "JOBS");
    assert.equal(out.find((k) => k.keyword === "free notion download")?.negativeGroup, "FREE");
    assert.equal(out.find((k) => k.keyword === "notion login")?.negativeGroup, "ACCOUNT");
    assert.equal(out.find((k) => k.keyword === "notion wholesale")?.negativeGroup, "OTHER");
  });

  it("colapsa a mesma frase com palavras trocadas", () => {
    const out = sanitizeKeywordItems([
      { keyword: "buy glucotrust", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
      { keyword: "glucotrust buy", intent: "INFORMATIONAL", relevance: "LOW", negativeSuggestion: false },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.intent, "BUY");
  });

  it("prioriza BUY sobre INFORMATIONAL no mesmo texto", () => {
    const out = sanitizeKeywordItems([
      { keyword: "foo bar", intent: "INFORMATIONAL", relevance: "MEDIUM", negativeSuggestion: false },
      { keyword: "foo bar", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.intent, "BUY");
  });
});

describe("parseLlmKeywordPayload", () => {
  it("aceita JSON estruturado", () => {
    const items = parseLlmKeywordPayload(
      JSON.stringify({
        keywords: [
          { keyword: "glucotrust buy", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
          { keyword: "glucotrust review", intent: "COMMERCIAL", relevance: "MEDIUM", negativeSuggestion: false },
          { keyword: "what is glucotrust", intent: "INFORMATIONAL", relevance: "MEDIUM", negativeSuggestion: false },
          { keyword: "glucotrust alternatives", intent: "COMPARISON", relevance: "MEDIUM", negativeSuggestion: false },
          { keyword: "glucotrust", intent: "BRAND", relevance: "HIGH", negativeSuggestion: false },
          { keyword: "glucotrust scam", intent: "NEGATIVE", relevance: "LOW", negativeSuggestion: true },
          { keyword: "buy glucotrust online", intent: "BUY", relevance: "HIGH", negativeSuggestion: false },
          { keyword: "glucotrust discount", intent: "COMMERCIAL", relevance: "MEDIUM", negativeSuggestion: false },
        ],
      }),
    );
    assert.ok(items.length >= 8);
  });

  it("falha com JSON inválido", () => {
    assert.throws(() => parseLlmKeywordPayload("not-json"));
  });

  it("falha com poucas sugestões", () => {
    assert.throws(() =>
      parseLlmKeywordPayload(JSON.stringify({ keywords: [{ keyword: "only one", intent: "BUY", relevance: "HIGH", negativeSuggestion: false }] })),
    );
  });
});

describe("buildDeterministicKeywords", () => {
  it("gera categorias para GlucoTrust EN sem métricas inventadas", () => {
    const items = buildDeterministicKeywords("GlucoTrust", "en");
    assert.ok(items.length >= 20);
    const intents = new Set(items.map((i) => i.intent));
    assert.ok(intents.has("BUY"));
    assert.ok(intents.has("COMMERCIAL"));
    assert.ok(intents.has("INFORMATIONAL"));
    assert.ok(intents.has("COMPARISON"));
    assert.ok(intents.has("BRAND"));
    assert.ok(intents.has("NEGATIVE"));
    assert.ok(items.every((i) => !("volume" in i) && !("cpc" in i)));
    assert.ok(items.some((i) => i.keyword.includes("buy")));
    assert.equal(items.find((i) => i.intent === "BUY")?.funnel, "BOTTOM");
    assert.equal(items.find((i) => i.intent === "INFORMATIONAL")?.funnel, "TOP");
    assert.equal(items.find((i) => i.intent === "COMPARISON")?.funnel, "MIDDLE");
    assert.equal(items.find((i) => i.intent === "NEGATIVE")?.funnel, null);
    assert.equal(items.find((i) => i.keyword === "glucotrust scam")?.intent, "COMMERCIAL");
    assert.equal(items.find((i) => i.keyword === "glucotrust jobs")?.negativeGroup, "JOBS");
    assert.ok(!items.some((i) => i.keyword.endsWith(" vs")));
  });

  it("PT gera frases em português", () => {
    const items = buildDeterministicKeywords("GlucoTrust", "pt");
    assert.ok(items.some((i) => i.keyword.includes("comprar")));
  });
});

describe("keywordGenerateInputSchema", () => {
  it("exige produto, idioma e mercado", () => {
    const ok = keywordGenerateInputSchema.safeParse({
      product: "GlucoTrust",
      language: "en",
      market: "us",
    });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.market, "US");
    const bad = keywordGenerateInputSchema.safeParse({ product: "x", language: "en", market: "US" });
    assert.equal(bad.success, false);
  });

  it("URL opcional; string vazia torna-se undefined", () => {
    const ok = keywordGenerateInputSchema.safeParse({
      product: "Hair",
      language: "en",
      market: "GB",
      product_url: "",
    });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.product_url, undefined);
  });
});

describe("marketName", () => {
  it("resolve US", () => {
    assert.equal(marketName("US"), "United States");
  });
});

describe("generateKeywordsForInput", () => {
  it("usa fallback determinístico sem OPENAI_API_KEY", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const out = await generateKeywordsForInput({ product: "GlucoTrust", language: "en", market: "US" });
      assert.equal(out.source, "deterministic");
      assert.equal(out.llmFailed, false);
      assert.ok(out.keywords.length >= 8);
      assert.equal(out.keywords.filter((k) => k.intent === "BUY").length > 0, true);
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });
});

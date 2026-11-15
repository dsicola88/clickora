import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { normalizePlannerLanguage, normalizePlannerMarket } from "./plannerTargeting";

/** Espelho do schema do controller — garante UK→GB, default→last_12, rejeição sem inventar. */
const analyzeSchema = z.object({
  product: z.string().trim().min(2).max(200),
  market: z
    .string()
    .trim()
    .min(2)
    .max(8)
    .transform((v, ctx) => {
      const n = normalizePlannerMarket(v);
      if (!n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Localização sem critério Google Ads (geoTargetConstants).",
        });
        return z.NEVER;
      }
      return n;
    }),
  language: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((v, ctx) => {
      const n = normalizePlannerLanguage(v);
      if (!n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Idioma sem critério Google Ads (languageConstants).",
        });
        return z.NEVER;
      }
      return n;
    }),
  timeframe: z
    .enum(["default", "last_1", "last_12", "last_24", "last_36", "all_available"])
    .default("last_12")
    .transform((v) => (v === "default" ? "last_12" : v)),
});

test("analyzeSchema normaliza UK/EN/default sem inventar", () => {
  const ok = analyzeSchema.safeParse({
    product: "visivra",
    market: "UK",
    language: "EN",
    timeframe: "default",
  });
  assert.equal(ok.success, true);
  if (!ok.success) return;
  assert.equal(ok.data.market, "GB");
  assert.equal(ok.data.language, "en");
  assert.equal(ok.data.timeframe, "last_12");
});

test("analyzeSchema rejeita mercado/idioma inválidos", () => {
  const badMarket = analyzeSchema.safeParse({
    product: "visivra",
    market: "ZZ",
    language: "en",
  });
  assert.equal(badMarket.success, false);

  const badLang = analyzeSchema.safeParse({
    product: "visivra",
    market: "US",
    language: "xx",
  });
  assert.equal(badLang.success, false);
});

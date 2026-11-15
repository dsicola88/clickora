/**
 * Critérios de localização/idioma do Planejador — alinhados com
 * `paid/geo-google.ts`, `paid/language-google.ts` e
 * `frontend/src/lib/googleAdsTargeting.ts`.
 * Sem inventar códigos: inválido → null.
 */
import { GOOGLE_GEO_CRITERION_IDS, normalizeGoogleCountryCode } from "../../paid/geo-google";
import {
  GOOGLE_ADS_LANGUAGE_NUMERIC_ID,
  normalizeGoogleLanguageCode,
} from "../../paid/language-google";

/** Países suportados (UK omitido — alias de GB). */
export const PLANNER_MARKET_CODES = Object.keys(GOOGLE_GEO_CRITERION_IDS).filter((c) => c !== "UK");

export const PLANNER_LANGUAGE_CODES = Object.keys(GOOGLE_ADS_LANGUAGE_NUMERIC_ID);

export function normalizePlannerMarket(raw: string): string | null {
  const n = normalizeGoogleCountryCode(raw);
  if (!n) return null;
  const code = n === "UK" ? "GB" : n;
  return PLANNER_MARKET_CODES.includes(code) ? code : null;
}

export function normalizePlannerLanguage(raw: string): string | null {
  const n = normalizeGoogleLanguageCode(raw);
  if (!n) return null;
  return PLANNER_LANGUAGE_CODES.includes(n) ? n : null;
}

export function isPlannerMarket(code: string): boolean {
  return normalizePlannerMarket(code) != null;
}

export function isPlannerLanguage(code: string): boolean {
  return normalizePlannerLanguage(code) != null;
}

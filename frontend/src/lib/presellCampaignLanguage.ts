import type { PresellLocaleKey } from "@/lib/presellUiStrings.types";
import { normalizePresellLocale, PRESHELL_LOCALE_KEYS } from "@/lib/presellUiStrings";

const COUNTRY_TO_LANGUAGE: Record<string, PresellLocaleKey> = {
  US: "en",
  CA: "en",
  AU: "en",
  GB: "en",
  UK: "en",
  NZ: "en",
  IE: "en",
  SG: "en",
  BR: "pt-BR",
  PT: "pt-BR",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  DE: "de",
  AT: "de",
  CH: "de",
  FR: "fr",
  BE: "fr",
  IT: "it",
  PL: "pl",
  NL: "nl",
  SE: "sv",
  NO: "no",
  DK: "da",
  TR: "tr",
};

/** País ISO (passo campanha / marketCountry) → idioma da presell e do CMP. */
export function defaultPresellLanguageForAdCountry(country: string): PresellLocaleKey | null {
  const code = country.trim().toUpperCase().slice(0, 2);
  if (!code) return null;
  return COUNTRY_TO_LANGUAGE[code] ?? null;
}

type ImportLanguageConfidence = "high" | "medium" | "low";

/** Aplica idioma devolvido pelo import-from-url quando a detecção não é «low». */
export function presellLanguageFromImport(
  selected: PresellLocaleKey,
  detected?: string,
  confidence?: ImportLanguageConfidence,
): PresellLocaleKey {
  if (!detected || confidence === "low") return selected;
  const norm = normalizePresellLocale(detected);
  if (!(PRESHELL_LOCALE_KEYS as readonly string[]).includes(norm)) return selected;
  if (confidence === "high") return norm;
  if (confidence === "medium" && norm !== selected) return norm;
  return selected;
}
/**
 * Política de consentimento por mercado.
 * Cookie-type: marketing sempre gated até Aceitar (não regressir UE).
 * Outros tipos: strict aplica GCM denied antes das tags; flexible mantém inject histórico.
 */

import { getPresellGateKind } from "@/lib/presellTypeMeta";
import { normalizePresellLocale } from "@/lib/presellUiStrings";

export type ConsentMarketMode = "strict" | "flexible";

export type ConsentRuntimePolicy = {
  mode: ConsentMarketMode;
  cookieGate: boolean;
  /** Bloquear inject Meta/TikTok/Google/header até Aceitar. */
  gateMarketingUntilAccept: boolean;
  /** Chamar ensureGoogleConsentModeDefaults. */
  applyConsentModeDefaults: boolean;
  /** Valor do default GCM (true = denied). */
  consentModeDefaultDenied: boolean;
};

/** EEA + UK + CH + BR — consentimento prévio esperado. */
const STRICT_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
  "UK",
  "CH",
  "BR",
]);

const FLEXIBLE_COUNTRIES = new Set(["US", "CA"]);

/**
 * Países do selector no painel (consent / ads market).
 * Só entram códigos com modo explícito (flexible ou strict) — evita opções “mortas”.
 */
export const CONSENT_MARKET_COUNTRY_OPTIONS: ReadonlyArray<{
  code: string;
  label: string;
}> = (
  [
    { code: "US", label: "United States (US)" },
    { code: "CA", label: "Canada (CA)" },
    { code: "GB", label: "United Kingdom (GB)" },
    { code: "DE", label: "Germany (DE)" },
    { code: "FR", label: "France (FR)" },
    { code: "ES", label: "Spain (ES)" },
    { code: "IT", label: "Italy (IT)" },
    { code: "PT", label: "Portugal (PT)" },
    { code: "BR", label: "Brazil (BR)" },
    { code: "NL", label: "Netherlands (NL)" },
    { code: "PL", label: "Poland (PL)" },
  ] as const
).filter(
  (o) => FLEXIBLE_COUNTRIES.has(o.code) || STRICT_COUNTRIES.has(o.code),
);

/** Idiomas que tipicamente implicam mercado strict (sem país explícito). */
const STRICT_LANGS = new Set([
  "de",
  "fr",
  "it",
  "es",
  "nl",
  "pl",
  "pt",
  "pt-BR",
  "da",
  "sv",
  "no",
  "ar",
  "hi",
  "tr",
]);

export function readMarketCountryHint(
  settings?: Record<string, unknown> | null,
  content?: Record<string, unknown> | null,
): string {
  const keys = [
    "marketCountry",
    "market_country",
    "adsCountry",
    "ads_country",
    "targetCountry",
    "target_country",
    "countryCode",
    "country_code",
  ];
  for (const k of keys) {
    const v = settings?.[k] ?? content?.[k];
    if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
  }
  return "";
}

export function resolveConsentMarketMode(input: {
  language?: string | null;
  marketCountry?: string | null;
}): ConsentMarketMode {
  const country = (input.marketCountry || "").trim().toUpperCase();
  if (FLEXIBLE_COUNTRIES.has(country)) return "flexible";
  if (STRICT_COUNTRIES.has(country)) return "strict";

  const lang = normalizePresellLocale(input.language || undefined);
  if (STRICT_LANGS.has(lang)) return "strict";
  // `en` sem país: strict por defeito (UK/ads UE); US/CA devem setar marketCountry.
  if (lang === "en") return "strict";
  return "strict";
}

export function resolveConsentRuntimePolicy(input: {
  presellType: string;
  language?: string | null;
  marketCountry?: string | null;
}): ConsentRuntimePolicy {
  const mode = resolveConsentMarketMode(input);
  const cookieGate = getPresellGateKind(input.presellType || "") === "cookies";

  if (cookieGate) {
    return {
      mode,
      cookieGate: true,
      gateMarketingUntilAccept: true,
      applyConsentModeDefaults: true,
      consentModeDefaultDenied: true,
    };
  }

  if (mode === "strict") {
    return {
      mode,
      cookieGate: false,
      gateMarketingUntilAccept: false,
      applyConsentModeDefaults: true,
      consentModeDefaultDenied: true,
    };
  }

  return {
    mode,
    cookieGate: false,
    gateMarketingUntilAccept: false,
    applyConsentModeDefaults: false,
    consentModeDefaultDenied: false,
  };
}

/**
 * Se o GCM deve ficar granted após defaults.
 * Cookie gate → segue Aceitar; strict sem banner → denied; flexible → granted.
 */
export function resolveGcmGranted(
  policy: ConsentRuntimePolicy,
  marketingAllowed: boolean,
): boolean {
  if (policy.cookieGate) {
    return !policy.gateMarketingUntilAccept || marketingAllowed;
  }
  return !policy.consentModeDefaultDenied;
}

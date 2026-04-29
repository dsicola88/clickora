/**
 * Normalização ISO-3166 alpha-2 para critérios Google Ads (`geoTargetConstants/{resourceId}`).
 * Alinha com `frontend/src/lib/googleAdsTargeting.ts` e com a publicação em `google-ads.publish.ts`.
 */

/** ISO alpha-2 (uppercase) → ID do critério Google (geo target constant). */
export const GOOGLE_GEO_CRITERION_IDS: Record<string, number> = {
  US: 2840,
  CA: 2124,
  GB: 2826,
  UK: 2826,
  AU: 2036,
  BR: 2076,
  DE: 2276,
  FR: 2250,
  IT: 2380,
  ES: 2724,
  PT: 2620,
  NL: 2528,
  BE: 2056,
  CH: 2756,
  AT: 2040,
  SE: 2752,
  NO: 2622,
  DK: 2208,
  FI: 2246,
  PL: 2616,
  CZ: 2203,
  IE: 2372,
  GR: 2300,
  TR: 2792,
  IN: 2352,
  JP: 2392,
  MX: 2484,
  AR: 2004,
  CL: 2152,
  CO: 2170,
  NZ: 2554,
  ZA: 2710,
  SG: 2702,
  MY: 2642,
  TH: 2706,
  PH: 2608,
  ID: 2360,
  VN: 2410,
  RO: 1842,
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Etiquetas comuns PT/EN (e variantes típicas de LLM/texto livre).
 * Chaves = `compactAscii` (sem acentos, só letras, minúsculas).
 */
const LABEL_COMPACT_TO_ISO: Record<string, string> = {
  brasil: "BR",
  brazil: "BR",
  portugal: "PT",
  estadosunidos: "US",
  unitedstates: "US",
  usa: "US",
  eua: "US",
  america: "US",
  canada: "CA",
  reinounido: "GB",
  unitedkingdom: "GB",
  greatbritain: "GB",
  australia: "AU",
  alemanha: "DE",
  germany: "DE",
  deutschland: "DE",
  france: "FR",
  franca: "FR",
  italia: "IT",
  italy: "IT",
  espana: "ES",
  espanha: "ES",
  spain: "ES",
  espanhol: "ES",
  netherlands: "NL",
  paisesbaixos: "NL",
  holanda: "NL",
  belgica: "BE",
  belgium: "BE",
  switzerland: "CH",
  suica: "CH",
  austria: "AT",
  osterreich: "AT",
  sweden: "SE",
  suecia: "SE",
  norway: "NO",
  norge: "NO",
  noruega: "NO",
  denmark: "DK",
  dinamarca: "DK",
  finland: "FI",
  finlandia: "FI",
  poland: "PL",
  polonia: "PL",
  polska: "PL",
  czechia: "CZ",
  czechrepublic: "CZ",
  republicacheca: "CZ",
  repcheca: "CZ",
  ireland: "IE",
  irlanda: "IE",
  greece: "GR",
  ellada: "GR",
  turkey: "TR",
  turquia: "TR",
  india: "IN",
  indian: "IN",
  japan: "JP",
  japao: "JP",
  mexico: "MX",
  mejico: "MX",
  argentina: "AR",
  argentine: "AR",
  chile: "CL",
  colombia: "CO",
  newzealand: "NZ",
  novazelanda: "NZ",
  southafrica: "ZA",
  africadosul: "ZA",
  singapore: "SG",
  singapura: "SG",
  malaysia: "MY",
  malasia: "MY",
  thailand: "TH",
  tailandia: "TH",
  philippines: "PH",
  filipinas: "PH",
  indonesia: "ID",
  indonesien: "ID",
  vietnam: "VN",
  vietname: "VN",
  vietnao: "VN",
  romania: "RO",
  rumania: "RO",
  roumania: "RO",
};

function compactAscii(s: string): string {
  return stripDiacritics(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** País/região livre ou ISO (minúsc., nomes PT/EN) → código ISO-3166 alpha-2 suportado. */
export function normalizeGoogleCountryCode(raw: string): string | null {
  const t0 = String(raw ?? "").trim();
  if (!t0) return null;

  const ascii = stripDiacritics(t0).trim();
  if (/^[A-Za-z]{2}$/.test(ascii)) {
    const u = ascii.toUpperCase();
    return GOOGLE_GEO_CRITERION_IDS[u] != null ? u : null;
  }

  const c = compactAscii(t0);
  if (c.length === 2) {
    const u = c.toUpperCase();
    return GOOGLE_GEO_CRITERION_IDS[u] != null ? u : null;
  }

  const iso = LABEL_COMPACT_TO_ISO[c];
  return iso != null && GOOGLE_GEO_CRITERION_IDS[iso] != null ? iso : null;
}

export function normalizeGoogleGeoTargetsOrThrow(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const code = normalizeGoogleCountryCode(r);
    if (!code) {
      throw new Error(
        `País ou região «${String(r).slice(0, 80)}» não reconhecido. Utilize código ISO de duas letras (ex.: BR, PT, US) ou o nome (ex.: Brasil, Portugal, Estados Unidos).`,
      );
    }
    if (!seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  if (out.length === 0) {
    throw new Error("Indique pelo menos um país de segmentação válido.");
  }
  return out;
}

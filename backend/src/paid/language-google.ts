/**
 * Normalização de idiomas para critérios Google Ads (`languageConstants/{id}`).
 * Aceita ISO-639-1 (en, pt), variantes (en-us → en) e nomes comuns em PT/EN (inglês → en).
 */

/** Códigos ISO aceites em `google-ads.publish.ts` / LANG_ID. */
export const GOOGLE_ADS_LANGUAGE_ISO_CODES = new Set([
  "en",
  "de",
  "fr",
  "es",
  "it",
  "ja",
  "nl",
  "pt",
  "pl",
  "sv",
  "da",
  "fi",
  "no",
  "cs",
  "el",
  "hu",
  "ro",
  "ru",
  "tr",
  "ko",
  "zh",
  "hi",
  "ar",
]);

/** ISO-639-1 → ID numérico para `languageConstants/{id}` na API Google Ads (alinhado com publish). */
export const GOOGLE_ADS_LANGUAGE_NUMERIC_ID: Record<string, number> = {
  en: 1000,
  de: 1001,
  fr: 1002,
  es: 1003,
  it: 1004,
  ja: 1005,
  nl: 1010,
  pt: 1014,
  pl: 1045,
  sv: 1015,
  da: 1009,
  fi: 1011,
  no: 1012,
  cs: 1022,
  el: 1023,
  hu: 1024,
  ro: 1040,
  ru: 1031,
  tr: 1037,
  ko: 1018,
  zh: 1017,
  hi: 1020,
  ar: 1019,
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Nomes e erros comuns (LLM / texto livre) → ISO-639-1. */
const LABEL_TO_ISO: Record<string, string> = {
  ingles: "en",
  english: "en",
  ingl: "en",
  portugues: "pt",
  portuguese: "pt",
  espanhol: "es",
  spanish: "es",
  castelhano: "es",
  frances: "fr",
  francais: "fr",
  french: "fr",
  alemao: "de",
  german: "de",
  deutsch: "de",
  italiano: "it",
  italian: "it",
  neerlandes: "nl",
  holandes: "nl",
  dutch: "nl",
  polaco: "pl",
  polish: "pl",
  sueco: "sv",
  swedish: "sv",
  dinamarques: "da",
  danish: "da",
  noruegues: "no",
  norwegian: "no",
  finlandes: "fi",
  finnish: "fi",
  checo: "cs",
  czech: "cs",
  grego: "el",
  greek: "el",
  hungaro: "hu",
  hungarian: "hu",
  romeno: "ro",
  romanian: "ro",
  russo: "ru",
  russian: "ru",
  turco: "tr",
  turkish: "tr",
  japones: "ja",
  japanese: "ja",
  coreano: "ko",
  korean: "ko",
  chines: "zh",
  chinese: "zh",
  hindi: "hi",
  arabe: "ar",
  arabic: "ar",
};

/**
 * Devolve código ISO-639-1 de 2 letras ou null se não for possível mapear com segurança.
 * Aceita códigos (en, PT), locales (en-US), etiquetas («inglês», Ingles), pontuação e aspas mal fechadas.
 */
export function normalizeGoogleLanguageCode(raw: string): string | null {
  let t0 = String(raw ?? "").trim();
  if (!t0) return null;
  // Aspas / separadores repetidos quando o texto vem de LLM ou CSV
  t0 = t0.replace(/^[\s"'«»„““”‘’‚‹›]+|[\s"'«»„““”‘’‚‹›]+$/gu, "").trim();
  if (!t0) return null;

  let t = stripDiacritics(t0).toLowerCase().replace(/\s+/g, "");

  if (/^[a-z]{2}$/.test(t) && GOOGLE_ADS_LANGUAGE_ISO_CODES.has(t)) {
    return t;
  }

  if (/^[a-z]{2}-[a-z]{2,}$/.test(t)) {
    const base = t.slice(0, 2);
    if (GOOGLE_ADS_LANGUAGE_ISO_CODES.has(base)) return base;
  }

  // Só letras (ex.: "ingles." → "ingles", «inglês» → ingles já em t)
  const alpha = t.replace(/[^a-z]/g, "");

  let fromLabel = LABEL_TO_ISO[t] ?? LABEL_TO_ISO[alpha];
  if (fromLabel && GOOGLE_ADS_LANGUAGE_ISO_CODES.has(fromLabel)) return fromLabel;

  // Heurísticas seguras quando o modelo devolve nome completo ou variações comuns em PT
  if (alpha.startsWith("english")) return "en";
  if (alpha.startsWith("portug") || alpha.startsWith("portuguese")) return "pt";
  if (alpha.startsWith("spanish") || alpha.startsWith("espan")) return "es";
  if (alpha.startsWith("francaise") || alpha.startsWith("francais") || alpha.startsWith("french")) return "fr";
  if (alpha.startsWith("deutsch") || alpha.startsWith("german")) return "de";

  return null;
}

/** Normaliza lista única, na ordem de primeira ocorrência; falha com mensagem explícita se algum token for inválido. */
export function normalizeGoogleLanguageTargetsOrThrow(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const code = normalizeGoogleLanguageCode(r);
    if (!code) {
      throw new Error(
        `Idioma «${String(r).slice(0, 80)}» não reconhecido. Use códigos ISO-639-1 (ex.: en, pt) ou nomes como inglês, português, espanhol.`,
      );
    }
    if (!seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  if (out.length === 0) {
    throw new Error("Indique pelo menos um idioma válido.");
  }
  return out;
}

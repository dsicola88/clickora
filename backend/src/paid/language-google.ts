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
 */
export function normalizeGoogleLanguageCode(raw: string): string | null {
  const t0 = String(raw ?? "").trim();
  if (!t0) return null;
  let t = stripDiacritics(t0).toLowerCase().replace(/\s+/g, "");

  if (/^[a-z]{2}$/.test(t)) {
    return GOOGLE_ADS_LANGUAGE_ISO_CODES.has(t) ? t : null;
  }

  if (/^[a-z]{2}-[a-z]{2}$/.test(t)) {
    const base = t.slice(0, 2)!;
    return GOOGLE_ADS_LANGUAGE_ISO_CODES.has(base) ? base : null;
  }

  const fromLabel = LABEL_TO_ISO[t];
  if (fromLabel && GOOGLE_ADS_LANGUAGE_ISO_CODES.has(fromLabel)) return fromLabel;

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

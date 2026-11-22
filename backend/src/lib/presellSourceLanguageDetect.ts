/** Idiomas suportados na presell (alinhado ao frontend `PresellLocaleKey`). */
export const PRESELL_LOCALE_KEYS = [
  "en",
  "es",
  "pt-BR",
  "de",
  "fr",
  "it",
  "pl",
  "tr",
  "hi",
  "ar",
  "nl",
  "sv",
  "no",
  "da",
] as const;

export type PresellLocaleKey = (typeof PRESELL_LOCALE_KEYS)[number];

export type SalesPageLanguageConfidence = "high" | "medium" | "low";
export type SalesPageLanguageSource = "html-lang" | "og-locale" | "text-heuristic" | "fallback";

export type DetectedSalesPageLanguage = {
  locale: PresellLocaleKey;
  confidence: SalesPageLanguageConfidence;
  source: SalesPageLanguageSource;
};

export function normalizePresellLocaleKey(raw: string | undefined): PresellLocaleKey {
  const r = (raw || "pt-BR").trim().toLowerCase().replace(/_/g, "-");
  if (!r || r === "pt") return "pt-BR";
  if (r === "us" || r === "en" || r.startsWith("en-")) return "en";
  if (r.startsWith("es")) return "es";
  if (r.startsWith("pt-br") || r === "pt-br") return "pt-BR";
  if (r.startsWith("de")) return "de";
  if (r.startsWith("fr")) return "fr";
  if (r.startsWith("it")) return "it";
  if (r.startsWith("pl")) return "pl";
  if (r.startsWith("tr")) return "tr";
  if (r.startsWith("hi")) return "hi";
  if (r.startsWith("ar")) return "ar";
  if (r.startsWith("nl")) return "nl";
  if (r.startsWith("sv")) return "sv";
  if (r === "no" || r.startsWith("nb") || r.startsWith("nn")) return "no";
  if (r.startsWith("da")) return "da";
  return "pt-BR";
}

function extractHtmlLang(html: string): string | null {
  const m = html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i);
  return m?.[1]?.trim() || null;
}

function extractOgLocale(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:locale["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:locale["']/i,
    /<meta[^>]+name=["']language["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function visibleTextSample(html: string, maxLen = 12_000): string {
  const noScript = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  const noStyle = noScript.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const bodyMatch = noStyle.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const chunk = bodyMatch?.[1] ?? noStyle;
  const text = chunk
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
  return text.toLowerCase();
}

type TextScores = Partial<Record<PresellLocaleKey, number>>;

const TEXT_MARKERS: Record<PresellLocaleKey, RegExp[]> = {
  en: [
    /\b(the|and|with|your|this|that|from|order|buy now|free shipping|ingredients|money.?back)\b/g,
    /\b(offer|limited|today|guarantee|customers|reviews)\b/g,
  ],
  "pt-BR": [
    /\b(você|voce|comprar|agora|frete|grátis|gratis|produto|garantia|ingredientes)\b/g,
    /\b(parabéns|parabens|desconto|oferta|hoje|clientes)\b/g,
  ],
  es: [
    /\b(usted|comprar|ahora|gratis|envío|envio|producto|garantía|garantia|ingredientes)\b/g,
    /\b(oferta|hoy|clientes|descuento)\b/g,
  ],
  de: [
    /\b(und|ihr|ihre|kaufen|jetzt|kostenlos|versand|garantie|inhaltsstoffe)\b/g,
    /\b(angebot|heute|kunden)\b/g,
  ],
  fr: [
    /\b(votre|acheter|maintenant|gratuit|livraison|garantie|ingrédients|ingredients)\b/g,
    /\b(offre|aujourd'hui|clients)\b/g,
  ],
  it: [
    /\b(acquista|ora|gratuito|spedizione|garanzia|ingredienti|offerta|oggi)\b/g,
  ],
  pl: [
    /\b(kup|teraz|darmowa|wysyłka|gwarancja|składniki|oferta|dziś|dzis)\b/g,
  ],
  tr: [
    /\b(satin|şimdi|ücretsiz|kargo|garanti|içindekiler|teklif|bugün)\b/g,
  ],
  nl: [
    /\b(koop|nu|gratis|verzending|garantie|ingrediënten|aanbieding|vandaag)\b/g,
  ],
  sv: [/\b(köp|nu|gratis|frakt|garanti|ingredienser|erbjudande|idag)\b/g],
  no: [/\b(kjøp|nå|gratis|frakt|garanti|ingredienser|tilbud|i dag)\b/g],
  da: [/\b(køb|nu|gratis|forsendelse|garanti|ingredienser|tilbud|i dag)\b/g],
  hi: [/[\u0900-\u097F]{3,}/g],
  ar: [/[\u0600-\u06FF]{3,}/g],
};

function scoreTextLocales(sample: string): TextScores {
  const scores: TextScores = {};
  if (sample.length < 80) return scores;
  for (const key of PRESELL_LOCALE_KEYS) {
    let total = 0;
    for (const re of TEXT_MARKERS[key]) {
      const m = sample.match(re);
      total += m?.length ?? 0;
    }
    if (total > 0) scores[key] = total;
  }
  return scores;
}

function pickBestTextLocale(scores: TextScores): { locale: PresellLocaleKey; score: number } | null {
  let best: PresellLocaleKey | null = null;
  let bestScore = 0;
  let second = 0;
  for (const key of PRESELL_LOCALE_KEYS) {
    const s = scores[key] ?? 0;
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = key;
    } else if (s > second) {
      second = s;
    }
  }
  if (!best || bestScore < 4) return null;
  return { locale: best, score: bestScore - second };
}

export function detectSalesPageLanguage(html: string): DetectedSalesPageLanguage {
  const htmlLang = extractHtmlLang(html);
  if (htmlLang) {
    const locale = normalizePresellLocaleKey(htmlLang);
    return { locale, confidence: "high", source: "html-lang" };
  }

  const ogLocale = extractOgLocale(html);
  if (ogLocale) {
    const locale = normalizePresellLocaleKey(ogLocale);
    return { locale, confidence: "high", source: "og-locale" };
  }

  const sample = visibleTextSample(html);
  const ranked = pickBestTextLocale(scoreTextLocales(sample));
  if (ranked) {
    const confidence: SalesPageLanguageConfidence = ranked.score >= 3 ? "medium" : "low";
    if (confidence !== "low") {
      return { locale: ranked.locale, confidence, source: "text-heuristic" };
    }
  }

  return { locale: "pt-BR", confidence: "low", source: "fallback" };
}

/** Idioma efetivo para copy/CMP: não força mudança em confiança baixa. */
export function resolveImportLanguage(
  requested: string | undefined,
  html: string,
): { language: PresellLocaleKey; detection: DetectedSalesPageLanguage } {
  const requestedNorm = normalizePresellLocaleKey(requested);
  const detection = detectSalesPageLanguage(html);
  if (detection.confidence === "high") {
    return { language: detection.locale, detection };
  }
  if (detection.confidence === "medium" && detection.locale !== requestedNorm) {
    return { language: detection.locale, detection };
  }
  return { language: requestedNorm, detection };
}
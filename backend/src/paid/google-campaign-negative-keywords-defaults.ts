/**
 * Negativos ao nível da campanha (Google Search): pacotes dinâmicos por idioma e geo,
 * fundidos com sugestões da IA e filtrados contra a identidade comercial (semente/oferta).
 *
 * Filosofia: cortar intenção meramente informativa e mercados paralelos típicos de DR,
 * sem bloquear singles demasiado amplos (“cost”, “funciona”) que diluem alcance útil.
 */

export type CampaignNegativeKeywordEntry = {
  text: string;
  match_type: "exact" | "phrase" | "broad";
};

/** Contexto para seleccionar pacotes regionais e filtrar colisões com a oferta. */
export type CampaignNegativeKeywordsMergeContext = {
  languageTargets: string[];
  geoTargets?: string[];
  /** Host da landing (ex.: loja.pt) — opcional para futuras extensões. */
  landingHostname?: string | null;
  campaignSeedKeyword?: string | null;
  offer?: string | null;
};

const MAX_CAMPAIGN_NEGATIVES = 175;

/** Mercados onde pesquisas em inglês misturam com comércio local. */
const GEO_PT_SUPPLEMENT = new Set([
  "BR",
  "PT",
  "AO",
  "MZ",
  "CV",
  "GW",
  "ST",
  "TL",
  "MO",
]);

/** Hispanófono — activa pacote ES além do núcleo EN. */
const GEO_ES_SUPPLEMENT = new Set([
  "ES",
  "MX",
  "AR",
  "CO",
  "CL",
  "PE",
  "EC",
  "VE",
  "GT",
  "BO",
  "DO",
  "HN",
  "PY",
  "SV",
  "NI",
  "CR",
  "PA",
  "UY",
  "PR",
  "GQ",
]);

/** Outras praças onde “Mercado Libre/Livre” é intenção marketplace frequente. */
const GEO_MERCADO_LIBRE_EXTRA = new Set([
  "MX",
  "AR",
  "CO",
  "CL",
  "PE",
  "EC",
  "VE",
  "GT",
  "BO",
  "DO",
  "HN",
  "PY",
  "SV",
  "NI",
  "CR",
  "PA",
  "UY",
]);

function normLang(code: string): string {
  return code.trim().toLowerCase().slice(0, 8);
}

function normGeo(code: string): string {
  return code.trim().toUpperCase().slice(0, 8);
}

function langs(languageTargets: string[]): string[] {
  return languageTargets.map(normLang).filter(Boolean);
}

function geos(geoTargets: string[] | undefined): string[] {
  return (geoTargets ?? []).map(normGeo).filter(Boolean);
}

export function wantsPortugueseNegativePack(languageTargets: string[], geoTargets: string[] | undefined): boolean {
  const L = langs(languageTargets);
  if (L.some((l) => l.startsWith("pt"))) return true;
  return geos(geoTargets).some((g) => GEO_PT_SUPPLEMENT.has(g));
}

export function wantsSpanishNegativePack(languageTargets: string[], geoTargets: string[] | undefined): boolean {
  const L = langs(languageTargets);
  if (L.some((l) => l.startsWith("es"))) return true;
  return geos(geoTargets).some((g) => GEO_ES_SUPPLEMENT.has(g));
}

export function wantsMercadoLibrePhrase(languageTargets: string[], geoTargets: string[] | undefined): boolean {
  const L = langs(languageTargets);
  if (L.some((l) => l.startsWith("es"))) return true;
  return geos(geoTargets).some((g) => GEO_MERCADO_LIBRE_EXTRA.has(g));
}

/**
 * Núcleo inglês — evita singles amplos (“work”, “cost”, “drink”) que não são só intenção DR.
 * Mantém frases com intenção clara (does it work, how much, …).
 */
export const EXAMPLE_DIRECT_RESPONSE_NEGATIVE_KEYWORDS_EN: readonly string[] = [
  "free",
  "download",
  "pdf",
  "review",
  "reviews",
  "side effect",
  "side effects",
  "complaint",
  "complaints",
  "recipe",
  "amazon",
  "how much",
  "ingredients list",
  "scam",
  "scams",
  "how to use",
  "does it work",
  "real reviews",
  "real people reviews",
  "phone number",
  "money back",
  "reddit",
  "testimonial",
  "testimonials",
  "contact number",
  "ebay",
  "return policy",
  "coupon code",
  "discount code",
  "promo code",
  "wholesale",
  "bulk buy",
  "used",
  "second hand",
  "wiki",
  "wikipedia",
  "youtube",
  "tiktok",
] as const;

export const EXAMPLE_DIRECT_RESPONSE_NEGATIVE_KEYWORDS_PT: readonly string[] = [
  "grátis",
  "gratis",
  "download",
  "pdf",
  "avaliação",
  "avaliações",
  "resenha",
  "resenhas",
  "efeito secundário",
  "efeitos secundários",
  "reclamação",
  "reclamações",
  "receita",
  "amazon",
  "mercado livre",
  "mercadolivre",
  "quanto custa",
  "lista de ingredientes",
  "golpe",
  "golpes",
  "fraude",
  "fraudes",
  "como usar",
  "depoimento",
  "depoimentos",
  "telefone",
  "número de telefone",
  "numero de telefone",
  "contato",
  "contacto",
  "ebay",
  "devolução",
  "política de devolução",
  "politica de devolução",
  "reddit",
  "dinheiro de volta",
  "cupom",
  "código promocional",
  "codigo promocional",
  "wiki",
  "youtube",
  "tiktok",
] as const;

/** Pacote ES para pesquisas hispanófonas — complementar ao núcleo EN. */
export const EXAMPLE_DIRECT_RESPONSE_NEGATIVE_KEYWORDS_ES: readonly string[] = [
  "gratis",
  "descarga",
  "pdf",
  "reseña",
  "reseñas",
  "opinión",
  "opiniones",
  "efecto secundario",
  "efectos secundarios",
  "queja",
  "quejas",
  "receta",
  "amazon",
  "mercado libre",
  "lista de ingredientes",
  "estafa",
  "estafas",
  "fraude",
  "fraudes",
  "como usar",
  "telefono",
  "teléfono",
  "numero de telefono",
  "número de teléfono",
  "ebay",
  "devolución",
  "reddit",
  "cupón",
  "codigo promocional",
  "código promocional",
  "wiki",
  "youtube",
  "tiktok",
  "mayoreo",
  "segunda mano",
] as const;

const GENERIC_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "your",
  "our",
  "best",
  "buy",
  "shop",
  "order",
  "now",
  "get",
  "official",
  "site",
  "online",
]);

/** Termos demasiado genéricos para os tratar como «marca» ao filtrar negativos. */
const WORDS_NEVER_USED_AS_BRAND_GUARD = new Set([
  ...GENERIC_STOPWORDS,
  "free",
  "sale",
  "sales",
  "discount",
  "offer",
  "offers",
  "deal",
  "deals",
  "review",
  "reviews",
  "cheap",
  "coupon",
  "coupons",
  "promo",
  "code",
]);

/** Frases comerciais que não devem ser negativas acidentais. */
function identityKeys(ctx: CampaignNegativeKeywordsMergeContext): Set<string> {
  const keys = new Set<string>();
  const addPhrase = (raw: string | null | undefined) => {
    const s = raw?.trim().toLowerCase().replace(/\s+/g, " ");
    if (s && s.length >= 2) keys.add(s);
  };
  addPhrase(ctx.campaignSeedKeyword ?? undefined);
  addPhrase(ctx.offer ?? undefined);
  const offer = ctx.offer?.trim().toLowerCase() ?? "";
  for (const w of offer.split(/\s+/)) {
    const t = w.replace(/[^a-z0-9à-ÿ\-]/gi, "");
    if (t.length >= 4 && !WORDS_NEVER_USED_AS_BRAND_GUARD.has(t)) keys.add(t);
  }
  const seed = ctx.campaignSeedKeyword?.trim().toLowerCase() ?? "";
  for (const w of seed.split(/\s+/)) {
    const t = w.replace(/[^a-z0-9à-ÿ\-]/gi, "");
    if (t.length >= 3 && !WORDS_NEVER_USED_AS_BRAND_GUARD.has(t)) keys.add(t);
  }
  return keys;
}

/** Remove negativos que coincidem com a marca/semente para não sabotar alcance próprio. */
export function filterNegativesAgainstCommercialIdentity(
  entries: CampaignNegativeKeywordEntry[],
  ctx: CampaignNegativeKeywordsMergeContext,
): CampaignNegativeKeywordEntry[] {
  const identities = identityKeys(ctx);
  if (!identities.size) return entries;
  return entries.filter((row) => {
    const k = row.text.trim().toLowerCase().replace(/\s+/g, " ");
    if (!k) return false;
    return !identities.has(k);
  });
}

function normalizeMatch(m: unknown): "exact" | "phrase" | "broad" {
  return m === "exact" || m === "broad" ? m : "phrase";
}

/** Lista para debug ou relatórios (sem IA). */
export function exampleNegativeKeywordTextsForLanguages(languageTargets: string[], geoTargets?: string[]): string[] {
  const ctx: CampaignNegativeKeywordsMergeContext = { languageTargets, geoTargets };
  const merged = mergeCampaignNegativeKeywordPlan(ctx, []);
  return merged.map((m) => m.text);
}

/** Classificados dominantes por TLD da landing — reforço dinâmico discreto. */
function appendRegionalClassifiedHints(
  hostname: string | null | undefined,
  pushPhrase: (raw: string) => void,
): void {
  const h = (hostname ?? "").toLowerCase();
  if (!h) return;
  if (h.endsWith(".co.uk") || h.endsWith(".uk")) {
    pushPhrase("gumtree");
    pushPhrase("facebook marketplace");
  } else if (h.endsWith(".com.au")) {
    pushPhrase("gumtree");
  } else if (h.endsWith(".ca")) {
    pushPhrase("kijiji");
  } else if (h.endsWith(".fr")) {
    pushPhrase("leboncoin");
  } else if (h.endsWith(".de")) {
    pushPhrase("ebay kleinanzeigen");
    pushPhrase("kleinanzeigen");
  }
}

/**
 * Une núcleo dinâmico (EN + pacotes PT/ES/geo), IA e filtros de identidade.
 */
export function landingHostnameFromUrl(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.replace(/^www\./i, "");
    return h || undefined;
  } catch {
    return undefined;
  }
}

export function mergeCampaignNegativeKeywordPlan(
  ctx: CampaignNegativeKeywordsMergeContext,
  fromAi: CampaignNegativeKeywordEntry[] | undefined,
): CampaignNegativeKeywordEntry[] {
  const { languageTargets, geoTargets } = ctx;
  const map = new Map<string, CampaignNegativeKeywordEntry>();

  const pushText = (raw: string, match: "exact" | "phrase" | "broad") => {
    const text = raw.trim().slice(0, 80);
    if (!text) return;
    const key = text.toLowerCase();
    if (map.has(key)) return;
    map.set(key, { text, match_type: match });
  };

  /** Phrase por defeito — comportamento uniforme entre mercados e alinhado ao estúdio Google. */
  const pushPhrase = (raw: string) => pushText(raw, "phrase");

  for (const s of EXAMPLE_DIRECT_RESPONSE_NEGATIVE_KEYWORDS_EN) {
    pushPhrase(s);
  }

  if (wantsPortugueseNegativePack(languageTargets, geoTargets)) {
    for (const s of EXAMPLE_DIRECT_RESPONSE_NEGATIVE_KEYWORDS_PT) {
      pushPhrase(s);
    }
  }

  if (wantsSpanishNegativePack(languageTargets, geoTargets)) {
    for (const s of EXAMPLE_DIRECT_RESPONSE_NEGATIVE_KEYWORDS_ES) {
      pushPhrase(s);
    }
  }

  if (wantsMercadoLibrePhrase(languageTargets, geoTargets)) {
    pushPhrase("mercado libre");
  }

  appendRegionalClassifiedHints(ctx.landingHostname, pushPhrase);

  for (const row of fromAi ?? []) {
    if (typeof row?.text !== "string") continue;
    pushText(row.text, normalizeMatch(row.match_type));
  }

  const merged = [...map.values()];
  const filtered = filterNegativesAgainstCommercialIdentity(merged, ctx);
  return filtered.slice(0, MAX_CAMPAIGN_NEGATIVES);
}

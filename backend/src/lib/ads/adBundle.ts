import { z } from "zod";
import type { KeywordItem } from "../keywordGenerator";
import { adPath, adDisplayName, adTextLength, normalizeAdText } from "./adText";
import { sentenceBelongsToProduct, winningDescriptions, winningHeadlines } from "./winningCopy";
import { CALLOUT_MAX, GOOGLE_RSA } from "./platformSpecs";

export const AD_PLATFORMS = ["google", "microsoft", "both"] as const;
export const AD_OBJECTIVES = ["purchase", "leads", "comparison", "commercial"] as const;
export type AdPlatformChoice = (typeof AD_PLATFORMS)[number];
export type AdObjective = (typeof AD_OBJECTIVES)[number];

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const adGenerateInputSchema = z.object({
  product: z.string().trim().min(2).max(200),
  language: z.enum(["en", "pt", "es", "fr", "de", "it"]),
  market: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  product_url: z.preprocess(emptyToUndef, z.string().url().max(2000).optional()),
  platform: z.enum(AD_PLATFORMS).default("google"),
  objective: z.enum(AD_OBJECTIVES).default("purchase"),
  niche: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
  description: z.preprocess(emptyToUndef, z.string().trim().max(1000).optional()),
  final_url: z.preprocess(emptyToUndef, z.string().url().max(2000).optional()),
  brand: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
  price_note: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
  offer_note: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
  guarantee_note: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
  promotion: z
    .object({
      kind: z.enum(["percent", "amount"]),
      value: z.string().trim().min(1).max(20),
      item: z.string().trim().max(40).optional(),
      start: z.string().trim().max(20).optional(),
      end: z.string().trim().max(20).optional(),
      terms: z.string().trim().max(160).optional(),
      url: z.string().url().max(2000).optional(),
    })
    .optional(),
  funnel: z.enum(["TOP", "MIDDLE", "BOTTOM"]).optional(),
});

export type AdGenerateInput = z.infer<typeof adGenerateInputSchema>;

export type LocaleId = "en-US" | "en-GB" | "pt-PT" | "pt-BR" | "es-ES" | "es-419" | "fr-FR" | "de-DE" | "it-IT";

export function localeFor(language: string, market: string): LocaleId {
  const m = market.toUpperCase();
  if (language === "en") return m === "GB" || m === "AU" || m === "IE" || m === "NZ" ? "en-GB" : "en-US";
  if (language === "pt") return m === "BR" ? "pt-BR" : "pt-PT";
  if (language === "es") return m === "ES" ? "es-ES" : "es-419";
  if (language === "fr") return "fr-FR";
  if (language === "de") return "de-DE";
  return "it-IT";
}

export type AdAngle = "purchase" | "feature" | "comparison" | "audience" | "offer" | "brand";

export type TextAsset = { id: string; text: string; pin: 1 | 2 | 3 | null; angle?: AdAngle | null };
export type DescAsset = { id: string; text: string; pin: 1 | 2 | null };
export type SitelinkAsset = {
  id: string;
  text: string;
  url: string;
  description1: string;
  description2: string;
};
export type CalloutAsset = { id: string; text: string };
export type SnippetAsset = { header: string; values: string[] } | null;
export type PromotionAsset = {
  kind: "percent" | "amount";
  value: string;
  item: string;
  start: string;
  end: string;
  terms: string;
  url: string;
} | null;

export type AdBundle = {
  source: "llm" | "deterministic";
  llmFailed: boolean;
  locale: LocaleId;
  platform: AdPlatformChoice;
  objective: AdObjective;
  limitations: string[];
  headlines: TextAsset[];
  descriptions: DescAsset[];
  path1: string;
  path2: string;
  sitelinks: SitelinkAsset[];
  callouts: CalloutAsset[];
  snippet: SnippetAsset;
  promotion: PromotionAsset;
  businessName: string;
};

const UNSUPPORTED_CLAIM =
  /\b(100\s*%|garantido|guaranteed|n[uú]mero\s*1|number\s*(?:one|1)|#1|melhor do mercado|best on the market|resultados imediatos|instant results|clinically proven|comprovado clinicamente|cura|cure[sd]?)\b/i;

export function claimIsUserSupplied(text: string, notes: string): boolean {
  const found = text.match(UNSUPPORTED_CLAIM);
  if (!found) return true;
  return notes.toLowerCase().includes(found[0].toLowerCase());
}

const INSTRUCTION_LIKE =
  /ignore (all |any )?(previous|prior|above) instructions|you are now|system prompt|disregard (the |all )?(rules|instructions)|act as /i;

/** Copia frases da descrição. Não reescreve. Alegações e ordens embutidas não entram no anúncio. */
export function factualSourceSentences(description: string): { usable: string[]; confirm: string[]; dropped: string[] } {
  const parts = description
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeAdText(part))
    .filter((part) => part.length >= 8);
  const usable: string[] = [];
  const confirm: string[] = [];
  const dropped: string[] = [];
  for (const sentence of parts) {
    if (INSTRUCTION_LIKE.test(sentence)) {
      dropped.push(sentence);
      continue;
    }
    if (!claimIsUserSupplied(sentence, "")) {
      confirm.push(sentence);
      continue;
    }
    if (adTextLength(sentence) <= 90) usable.push(sentence);
    else dropped.push(sentence);
  }
  return { usable, confirm, dropped };
}

function id(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

function pushUnique(out: string[], value: string, max: number) {
  const text = normalizeAdText(value);
  if (!text) return;
  if (adTextLength(text) > max) return;
  const key = text.toLowerCase();
  if (out.some((x) => x.toLowerCase() === key)) return;
  out.push(text);
}

type CopyBank = {
  buy: (p: string) => string;
  official: (p: string) => string;
  order: (p: string) => string;
  details: (p: string) => string;
  compare: (p: string) => string;
  price: (p: string) => string;
  offer: (p: string) => string;
  shortBuy: string;
  shortOfficial: string;
  shortOrder: string;
  shortCompare: string;
  shortDetails: string;
  neutralOpen: string;
  descSee: (p: string) => string;
  descOrder: (p: string) => string;
  descCompare: (p: string) => string;
  descInfo: (p: string) => string;
  sitelinkDetails: string;
  sitelinkOffer: string;
  sitelinkPending: string;
  sitelinkLine1: string;
  sitelinkLine2: string;
};

type SitelinkPack = {
  links: [string, string, string, string];
  line1: [string, string, string, string];
  line2: [string, string, string, string];
  snippetHeader: string;
  neutralCallouts: string[];
};

const SITELINK_PACKS: Record<LocaleId, SitelinkPack> = {
  "en-US": {
    links: ["Official Site", "Order Online", "Product Info", "Compare Options"],
    line1: ["Visit the official page.", "Continue to checkout.", "See offer details.", "Review before you buy."],
    line2: ["Secure landing page.", "Same offer page.", "Facts from the page.", "No extra claims."],
    snippetHeader: "Types",
    neutralCallouts: ["Official Page", "Secure Site", "View Details", "Shop Online"],
  },
  "en-GB": {
    links: ["Official Site", "Order Online", "Product Info", "Compare Options"],
    line1: ["Visit the official page.", "Continue to checkout.", "See offer details.", "Review before you buy."],
    line2: ["Secure landing page.", "Same offer page.", "Facts from the page.", "No extra claims."],
    snippetHeader: "Types",
    neutralCallouts: ["Official Page", "Secure Site", "View Details", "Shop Online"],
  },
  "pt-BR": {
    links: ["Site oficial", "Comprar online", "Detalhes", "Comparar"],
    line1: ["Abra a página oficial.", "Siga para a oferta.", "Veja os detalhes.", "Compare antes de decidir."],
    line2: ["Página de destino.", "Mesma oferta.", "Factos da página.", "Sem promessas extra."],
    snippetHeader: "Tipos",
    neutralCallouts: ["Página oficial", "Site seguro", "Ver detalhes", "Comprar online"],
  },
  "pt-PT": {
    links: ["Site oficial", "Encomendar", "Detalhes", "Comparar"],
    line1: ["Abra a página oficial.", "Avance para a oferta.", "Veja os detalhes.", "Compare antes de decidir."],
    line2: ["Página de destino.", "Mesma oferta.", "Factos da página.", "Sem promessas extra."],
    snippetHeader: "Tipos",
    neutralCallouts: ["Página oficial", "Site seguro", "Ver detalhes", "Comprar online"],
  },
  "es-419": {
    links: ["Sitio oficial", "Comprar online", "Detalles", "Comparar"],
    line1: ["Abre la página oficial.", "Continúa a la oferta.", "Mira los detalles.", "Compara antes de decidir."],
    line2: ["Página de destino.", "Misma oferta.", "Datos de la página.", "Sin promesas extra."],
    snippetHeader: "Tipos",
    neutralCallouts: ["Página oficial", "Sitio seguro", "Ver detalles", "Comprar online"],
  },
  "es-ES": {
    links: ["Sitio oficial", "Comprar online", "Detalles", "Comparar"],
    line1: ["Abre la página oficial.", "Continúa a la oferta.", "Consulta los detalles.", "Compara antes de decidir."],
    line2: ["Página de destino.", "Misma oferta.", "Datos de la página.", "Sin promesas extra."],
    snippetHeader: "Tipos",
    neutralCallouts: ["Página oficial", "Sitio seguro", "Ver detalles", "Comprar online"],
  },
  "fr-FR": {
    links: ["Site officiel", "Commander", "Détails", "Comparer"],
    line1: ["Ouvrez la page officielle.", "Accédez à l'offre.", "Voir les détails.", "Comparez avant d'acheter."],
    line2: ["Page de destination.", "Même offre.", "Faits de la page.", "Sans promesse extra."],
    snippetHeader: "Types",
    neutralCallouts: ["Page officielle", "Site sécurisé", "Voir détails", "Acheter en ligne"],
  },
  "de-DE": {
    links: ["Offizielle Seite", "Online bestellen", "Produktdetails", "Vergleichen"],
    line1: ["Offizielle Seite öffnen.", "Zur Angebotsseite.", "Details ansehen.", "Vor dem Kauf vergleichen."],
    line2: ["Zielseite.", "Gleiches Angebot.", "Fakten von der Seite.", "Keine Extra-Versprechen."],
    snippetHeader: "Typen",
    neutralCallouts: ["Offizielle Seite", "Sichere Seite", "Details ansehen", "Online kaufen"],
  },
  "it-IT": {
    links: ["Sito ufficiale", "Ordina online", "Dettagli", "Confronta"],
    line1: ["Apri la pagina ufficiale.", "Vai all'offerta.", "Vedi i dettagli.", "Confronta prima di acquistare."],
    line2: ["Pagina di destinazione.", "Stessa offerta.", "Fatti dalla pagina.", "Nessuna promessa extra."],
    snippetHeader: "Tipi",
    neutralCallouts: ["Pagina ufficiale", "Sito sicuro", "Vedi dettagli", "Acquista online"],
  },
};

function buildProfessionalSitelinks(locale: LocaleId, destination: string): SitelinkAsset[] {
  const pack = SITELINK_PACKS[locale];
  if (!destination.trim()) {
    return [
      {
        id: "sl-1",
        text: pack.links[0],
        url: "",
        description1: "",
        description2: "",
      },
    ];
  }
  return pack.links.map((text, i) => ({
    id: `sl-${i + 1}`,
    text,
    url: destination,
    description1: pack.line1[i] ?? "",
    description2: pack.line2[i] ?? "",
  }));
}

/** Snippet só com lista real confirmada (página/LLM). O fallback determinístico não inventa valores. */
export function buildStructuredSnippet(
  _keywords: KeywordItem[],
  _locale: LocaleId,
  _product: string,
): SnippetAsset {
  return null;
}

const BANKS: Record<LocaleId, CopyBank> = {
  "en-US": {
    buy: (p) => `Buy ${p}`,
    official: (p) => `${p} Official Site`,
    order: (p) => `Order ${p} Online`,
    details: (p) => `See ${p} Details`,
    compare: (p) => `Compare ${p}`,
    price: (p) => `${p} Price`,
    offer: (p) => `${p} Current Offer`,
    shortBuy: "Buy Online",
    shortOfficial: "See the Offer",
    shortOrder: "Order Online",
    shortCompare: "Compare Options",
    shortDetails: "See Details",
    neutralOpen: "Open the offer page",
    descSee: (p) => `See ${p} and continue to the page for this offer.`,
    descOrder: (p) => `Order ${p} online and review the page before you buy.`,
    descCompare: (p) => `Compare ${p} with the alternatives you already know before you decide.`,
    descInfo: (p) => `Read what ${p} is, then visit the page for the facts that apply to this offer.`,
    sitelinkDetails: "Product details",
    sitelinkOffer: "Current offer",
    sitelinkPending: "Add a real page",
    sitelinkLine1: "Open this product page.",
    sitelinkLine2: "Review the details there.",
  },
  "en-GB": {
    buy: (p) => `Buy ${p}`,
    official: (p) => `${p} Official Site`,
    order: (p) => `Order ${p} Online`,
    details: (p) => `View ${p} Details`,
    compare: (p) => `Compare ${p}`,
    price: (p) => `${p} Price`,
    offer: (p) => `${p} Current Offer`,
    shortBuy: "Buy Online",
    shortOfficial: "See the Offer",
    shortOrder: "Order Online",
    shortCompare: "Compare Options",
    shortDetails: "View Details",
    neutralOpen: "Open the offer page",
    descSee: (p) => `View ${p} and continue to the page for this offer.`,
    descOrder: (p) => `Order ${p} online and review the page before you buy.`,
    descCompare: (p) => `Compare ${p} with the alternatives you already know before you decide.`,
    descInfo: (p) => `Read what ${p} is, then visit the page for the facts that apply to this offer.`,
    sitelinkDetails: "Product details",
    sitelinkOffer: "Current offer",
    sitelinkPending: "Add a real page",
    sitelinkLine1: "Open this product page.",
    sitelinkLine2: "Review the details there.",
  },
  "pt-PT": {
    buy: (p) => `Comprar ${p}`,
    official: (p) => `${p} Site Oficial`,
    order: (p) => `Encomendar ${p}`,
    details: (p) => `Ver ${p}`,
    compare: (p) => `Comparar ${p}`,
    price: (p) => `Preço ${p}`,
    offer: (p) => `Oferta ${p}`,
    shortBuy: "Comprar online",
    shortOfficial: "Ver a oferta",
    shortOrder: "Encomendar",
    shortCompare: "Comparar opções",
    shortDetails: "Ver detalhes",
    neutralOpen: "Abrir a página da oferta",
    descSee: (p) => `Veja ${p} e continue para a página desta oferta.`,
    descOrder: (p) => `Encomende ${p} e confirme a página antes de comprar.`,
    descCompare: (p) => `Compare ${p} com as alternativas que já conhece antes de decidir.`,
    descInfo: (p) => `Leia o que é ${p} e confirme na página os factos desta oferta.`,
    sitelinkDetails: "Detalhes",
    sitelinkOffer: "Oferta actual",
    sitelinkPending: "Página por indicar",
    sitelinkLine1: "Abra a página do produto.",
    sitelinkLine2: "Confirme os detalhes lá.",
  },
  "pt-BR": {
    buy: (p) => `Comprar ${p}`,
    official: (p) => `${p} Site Oficial`,
    order: (p) => `Pedir ${p}`,
    details: (p) => `Ver ${p}`,
    compare: (p) => `Comparar ${p}`,
    price: (p) => `Preço ${p}`,
    offer: (p) => `Oferta ${p}`,
    shortBuy: "Comprar online",
    shortOfficial: "Ver a oferta",
    shortOrder: "Pedir online",
    shortCompare: "Comparar opções",
    shortDetails: "Ver detalhes",
    neutralOpen: "Abrir a página da oferta",
    descSee: (p) => `Veja ${p} e continue para a página desta oferta.`,
    descOrder: (p) => `Peça ${p} e confira a página antes de comprar.`,
    descCompare: (p) => `Compare ${p} com as alternativas que você já conhece antes de decidir.`,
    descInfo: (p) => `Entenda o que é ${p} e confira na página os fatos desta oferta.`,
    sitelinkDetails: "Detalhes",
    sitelinkOffer: "Oferta atual",
    sitelinkPending: "Página por indicar",
    sitelinkLine1: "Abra a página do produto.",
    sitelinkLine2: "Confira os detalhes lá.",
  },
  "es-ES": {
    buy: (p) => `Comprar ${p}`,
    official: (p) => `${p} Sitio Oficial`,
    order: (p) => `Pedir ${p}`,
    details: (p) => `Ver ${p}`,
    compare: (p) => `Comparar ${p}`,
    price: (p) => `Precio ${p}`,
    offer: (p) => `Oferta ${p}`,
    shortBuy: "Comprar online",
    shortOfficial: "Ver la oferta",
    shortOrder: "Pedir online",
    shortCompare: "Comparar opciones",
    shortDetails: "Ver detalles",
    neutralOpen: "Abrir la página de la oferta",
    descSee: (p) => `Consulta ${p} y sigue a la página de esta oferta.`,
    descOrder: (p) => `Pide ${p} y revisa la página antes de comprar.`,
    descCompare: (p) => `Compara ${p} con las alternativas que ya conoces antes de decidir.`,
    descInfo: (p) => `Lee qué es ${p} y confirma en la página los datos de esta oferta.`,
    sitelinkDetails: "Detalles",
    sitelinkOffer: "Oferta actual",
    sitelinkPending: "Página pendiente",
    sitelinkLine1: "Abre la página del producto.",
    sitelinkLine2: "Revisa los detalles allí.",
  },
  "es-419": {
    buy: (p) => `Comprar ${p}`,
    official: (p) => `${p} Sitio Oficial`,
    order: (p) => `Pedir ${p}`,
    details: (p) => `Ver ${p}`,
    compare: (p) => `Comparar ${p}`,
    price: (p) => `Precio ${p}`,
    offer: (p) => `Oferta ${p}`,
    shortBuy: "Comprar en línea",
    shortOfficial: "Ver la oferta",
    shortOrder: "Pedir en línea",
    shortCompare: "Comparar opciones",
    shortDetails: "Ver detalles",
    neutralOpen: "Abrir la página de la oferta",
    descSee: (p) => `Consulta ${p} y sigue a la página de esta oferta.`,
    descOrder: (p) => `Pide ${p} en línea y revisa la página antes de comprar.`,
    descCompare: (p) => `Compara ${p} con las alternativas que ya conoces antes de decidir.`,
    descInfo: (p) => `Lee qué es ${p} y confirma en la página los datos de esta oferta.`,
    sitelinkDetails: "Detalles",
    sitelinkOffer: "Oferta actual",
    sitelinkPending: "Página pendiente",
    sitelinkLine1: "Abre la página del producto.",
    sitelinkLine2: "Revisa los detalles allí.",
  },
  "fr-FR": {
    buy: (p) => `Acheter ${p}`,
    official: (p) => `${p} Site Officiel`,
    order: (p) => `Commander ${p}`,
    details: (p) => `Voir ${p}`,
    compare: (p) => `Comparer ${p}`,
    price: (p) => `Prix ${p}`,
    offer: (p) => `Offre ${p}`,
    shortBuy: "Acheter en ligne",
    shortOfficial: "Voir l'offre",
    shortOrder: "Commander",
    shortCompare: "Comparer",
    shortDetails: "Voir les détails",
    neutralOpen: "Ouvrir la page de l'offre",
    descSee: (p) => `Consultez ${p} et poursuivez vers la page de cette offre.`,
    descOrder: (p) => `Commandez ${p} et vérifiez la page avant d'acheter.`,
    descCompare: (p) => `Comparez ${p} aux alternatives que vous connaissez déjà avant de décider.`,
    descInfo: (p) => `Lisez ce qu'est ${p}, puis confirmez les faits sur la page de l'offre.`,
    sitelinkDetails: "Détails",
    sitelinkOffer: "Offre actuelle",
    sitelinkPending: "Page à indiquer",
    sitelinkLine1: "Ouvrez la page du produit.",
    sitelinkLine2: "Vérifiez les détails ici.",
  },
  "de-DE": {
    buy: (p) => `${p} kaufen`,
    official: (p) => `${p} Offizielle Seite`,
    order: (p) => `${p} bestellen`,
    details: (p) => `${p} ansehen`,
    compare: (p) => `${p} vergleichen`,
    price: (p) => `${p} Preis`,
    offer: (p) => `${p} Angebot`,
    shortBuy: "Online kaufen",
    shortOfficial: "Angebot ansehen",
    shortOrder: "Jetzt bestellen",
    shortCompare: "Optionen vergleichen",
    shortDetails: "Details ansehen",
    neutralOpen: "Angebotsseite öffnen",
    descSee: (p) => `Prüfen Sie ${p} und öffnen Sie die Seite zu diesem Angebot.`,
    descOrder: (p) => `Bestellen Sie ${p} und prüfen Sie die Seite vor dem Kauf.`,
    descCompare: (p) => `Vergleichen Sie ${p} mit Alternativen, die Sie bereits kennen.`,
    descInfo: (p) => `Lesen Sie, was ${p} ist, und prüfen Sie die Fakten auf der Angebotsseite.`,
    sitelinkDetails: "Details",
    sitelinkOffer: "Aktuelles Angebot",
    sitelinkPending: "Seite fehlt",
    sitelinkLine1: "Produktseite öffnen.",
    sitelinkLine2: "Details dort prüfen.",
  },
  "it-IT": {
    buy: (p) => `Compra ${p}`,
    official: (p) => `${p} Sito Ufficiale`,
    order: (p) => `Ordina ${p}`,
    details: (p) => `Vedi ${p}`,
    compare: (p) => `Confronta ${p}`,
    price: (p) => `Prezzo ${p}`,
    offer: (p) => `Offerta ${p}`,
    shortBuy: "Compra online",
    shortOfficial: "Vedi l'offerta",
    shortOrder: "Ordina online",
    shortCompare: "Confronta opzioni",
    shortDetails: "Vedi dettagli",
    neutralOpen: "Apri la pagina dell'offerta",
    descSee: (p) => `Guarda ${p} e continua alla pagina di questa offerta.`,
    descOrder: (p) => `Ordina ${p} e controlla la pagina prima di acquistare.`,
    descCompare: (p) => `Confronta ${p} con le alternative che già conosci prima di decidere.`,
    descInfo: (p) => `Leggi cos'è ${p} e conferma nella pagina i fatti di questa offerta.`,
    sitelinkDetails: "Dettagli",
    sitelinkOffer: "Offerta attuale",
    sitelinkPending: "Pagina da indicare",
    sitelinkLine1: "Apri la pagina del prodotto.",
    sitelinkLine2: "Controlla i dettagli lì.",
  },
};

function verifiedCallouts(input: AdGenerateInput): string[] {
  const notes = [input.price_note, input.offer_note, input.guarantee_note].filter(Boolean) as string[];
  const out: string[] = [];
  for (const note of notes) {
    const text = normalizeAdText(note);
    if (/[()[\]]/.test(text)) continue;
    if (adTextLength(text) > 0 && adTextLength(text) <= CALLOUT_MAX) out.push(text);
  }
  return out;
}

export function buildDeterministicBundle(input: AdGenerateInput, keywords: KeywordItem[]): AdBundle {
  const locale = localeFor(input.language, input.market);
  const bank = BANKS[locale];
  const p = adDisplayName(input.brand?.trim() || input.product.trim());
  const limitations: string[] = [
    "Fallback determinístico: frases-modelo no idioma do mercado, não uma redação da IA.",
  ];
  if (keywords.length < 8) {
    limitations.push("Poucas palavras-chave para agrupar temas de pesquisa.");
  }
  if (!input.description) limitations.push("Sem descrição verificada: os anúncios não acrescentam benefícios.");
  if (!input.final_url && !input.product_url) limitations.push("Sem URL de destino: os sitelinks ficam por preencher.");
  if (!input.promotion) limitations.push("Sem promoção confirmada: o recurso de promoção não foi criado.");

  const headlineTexts: string[] = [];
  const headlineAngles: Array<AdAngle | null> = [];
  const maxH = GOOGLE_RSA.headlineMax;
  const usedAngles = new Set<AdAngle>();
  const pushLine = (value: string, angle: AdAngle) => {
    const before = headlineTexts.length;
    pushUnique(headlineTexts, value, maxH);
    if (headlineTexts.length > before) {
      headlineAngles.push(angle);
      usedAngles.add(angle);
    }
  };
  for (const line of winningHeadlines(input, locale, maxH)) pushLine(line.text, line.angle);
  const facts = input.description ? factualSourceSentences(input.description) : null;
  const usableForProduct = (facts?.usable ?? []).filter((sentence) => sentenceBelongsToProduct(sentence, p));
  if (facts?.confirm.length) {
    limitations.push("A descrição tem alegações por confirmar. Não entraram nos anúncios.");
  }
  if (facts?.dropped.length) {
    limitations.push("Parte da descrição foi ignorada: texto que tenta dar instruções, ou frases longas demais para copiar sem reescrever.");
  }
  if (facts && facts.usable.length > usableForProduct.length) {
    limitations.push("Há frases na descrição que falam de outro produto ou são perguntas. Não entraram no anúncio.");
  }
  if (headlineTexts.length < 3) {
    for (const c of [bank.shortBuy, bank.shortOfficial, bank.shortOrder]) {
      if (headlineTexts.length >= 3) break;
      pushLine(c, "purchase");
    }
  }
  if (headlineTexts.length < 3) {
    limitations.push("O nome do produto não cabe em títulos de 30 caracteres. Encurte-o antes de usar.");
  }
  const skipped: string[] = [];
  if (!usedAngles.has("comparison")) skipped.push("comparação: o objetivo não é comparação");
  if (!usedAngles.has("offer")) skipped.push("oferta: sem preço ou oferta confirmados que caibam num título");
  if (!usedAngles.has("feature")) {
    skipped.push(
      input.description
        ? "característica: a descrição confirmada não cabe num título de 30 caracteres e não foi resumida"
        : "característica: sem descrição confirmada",
    );
  }
  skipped.push("público-alvo: não foi indicado");
  limitations.push(`Ângulos usados: ${[...usedAngles].join(", ") || "nenhum"}. Por preencher: ${skipped.join("; ")}.`);

  const descTexts = winningDescriptions(input, locale, usableForProduct, GOOGLE_RSA.descriptionMax);

  const destination = (input.final_url || input.product_url || "").trim();
  const sitelinks = buildProfessionalSitelinks(locale, destination);
  if (!destination) {
    limitations.push("Indique a URL final da presell para preencher sitelinks e caminhos como num pacote Search completo.");
  } else if (sitelinks.length < 4) {
    limitations.push("Sitelinks reduzidos: falta URL de destino válida.");
  }

  const callouts = verifiedCallouts(input).map((text, i) => ({ id: id("co", i + 1), text }));
  const hasOfferNotes = Boolean(input.price_note?.trim() || input.offer_note?.trim() || input.guarantee_note?.trim());
  if (callouts.length === 0 && destination && !hasOfferNotes) {
    const pack = SITELINK_PACKS[locale];
    for (const text of pack.neutralCallouts) {
      if (callouts.length >= 4) break;
      if (adTextLength(text) > 0 && adTextLength(text) <= CALLOUT_MAX) {
        callouts.push({ id: id("co", callouts.length + 1), text });
      }
    }
  }
  if (callouts.length === 0) {
    const notes = [input.price_note, input.offer_note, input.guarantee_note].filter(Boolean);
    limitations.push(
      notes.length
        ? "Nenhum preço, oferta ou garantia confirmados cabe em 25 caracteres. Não foram cortados para virar destaque."
        : "Destaques neutros só entram quando há URL final; caso contrário, ficam vazios até confirmar factos na página.",
    );
  }

  const snippet = buildStructuredSnippet(keywords, locale, p);

  const path1 = adPath(p, 15);
  const path2Wanted = input.objective === "comparison" || input.funnel === "MIDDLE" ? adPath("compare", 15) : "";
  const path2 = path1 && path2Wanted !== path1 ? path2Wanted : "";

  return {
    source: "deterministic",
    llmFailed: false,
    locale,
    platform: input.platform,
    objective: input.objective,
    limitations,
    headlines: headlineTexts.slice(0, 12).map((text, i) => ({ id: id("h", i + 1), text, pin: null, angle: headlineAngles[i] ?? null })),
    descriptions: descTexts.slice(0, 4).map((text, i) => ({ id: id("d", i + 1), text, pin: null })),
    path1,
    path2: path2 === path1 ? "" : path2,
    sitelinks,
    callouts,
    snippet,
    promotion: input.promotion
      ? {
          kind: input.promotion.kind,
          value: input.promotion.value,
          item: input.promotion.item || input.product,
          start: input.promotion.start || "",
          end: input.promotion.end || "",
          terms: input.promotion.terms || "",
          url: input.promotion.url || destination,
        }
      : null,
    businessName: p.slice(0, 25),
  };
}

export function notesBlob(input: AdGenerateInput): string {
  return [input.description, input.price_note, input.offer_note, input.guarantee_note, input.promotion?.terms]
    .filter(Boolean)
    .join("\n");
}

export function keywordThemes(keywords: KeywordItem[]): string[] {
  return [...new Set(keywords.map((k) => k.theme).filter((t): t is string => Boolean(t)))];
}

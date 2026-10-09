import { z } from "zod";
import type { KeywordItem } from "../keywordGenerator";
import { adTextLength, normalizeAdText, pathToken } from "./adText";
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
};

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
    shortOfficial: "Official Site",
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
    shortOfficial: "Official Site",
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
    shortOfficial: "Site oficial",
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
    shortOfficial: "Site oficial",
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
    shortOfficial: "Sitio oficial",
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
    shortOfficial: "Sitio oficial",
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
    shortOfficial: "Site officiel",
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
    shortOfficial: "Offizielle Seite",
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
    shortOfficial: "Sito ufficiale",
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
  },
};

function verifiedCallouts(input: AdGenerateInput): string[] {
  const notes = [input.price_note, input.offer_note, input.guarantee_note].filter(Boolean) as string[];
  const out: string[] = [];
  for (const note of notes) {
    const text = normalizeAdText(note);
    if (adTextLength(text) > 0 && adTextLength(text) <= CALLOUT_MAX) out.push(text);
  }
  return out;
}

export function buildDeterministicBundle(input: AdGenerateInput, keywords: KeywordItem[]): AdBundle {
  const locale = localeFor(input.language, input.market);
  const bank = BANKS[locale];
  const p = input.brand?.trim() || input.product.trim();
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
  pushLine(bank.buy(p), "purchase");
  pushLine(bank.official(p), "brand");
  pushLine(bank.neutralOpen, "purchase");
  if (input.objective === "comparison") pushLine(bank.compare(p), "comparison");
  const offerLine = [input.offer_note, input.price_note].find((note) => note && adTextLength(note) <= maxH);
  if (offerLine) pushLine(offerLine, "offer");
  const facts = input.description ? factualSourceSentences(input.description) : null;
  const headlineFact = facts?.usable.find((sentence) => adTextLength(sentence) <= maxH);
  if (headlineFact) pushLine(headlineFact, "feature");
  if (facts?.confirm.length) {
    limitations.push("A descrição tem alegações por confirmar. Não entraram nos anúncios.");
  }
  if (facts?.dropped.length) {
    limitations.push("Parte da descrição foi ignorada: texto que tenta dar instruções, ou frases longas demais para copiar sem reescrever.");
  }
  if (facts && !headlineFact && facts.usable.length) {
    limitations.push("Há factos na descrição, mas nenhum cabe num título de 30 caracteres. Não foram reescritos.");
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

  const descTexts: string[] = [];
  for (const sentence of facts?.usable ?? []) pushUnique(descTexts, sentence, GOOGLE_RSA.descriptionMax);
  for (const line of [bank.descSee(p), bank.descOrder(p), bank.descCompare(p), bank.descInfo(p)]) {
    pushUnique(descTexts, line, GOOGLE_RSA.descriptionMax);
  }

  const destination = input.final_url || input.product_url || "";
  const sitelinks: SitelinkAsset[] = [
    {
      id: "sl-1",
      text: bank.sitelinkDetails,
      url: destination,
      description1: "",
      description2: "",
    },
    {
      id: "sl-2",
      text: bank.sitelinkPending,
      url: "",
      description1: "",
      description2: "",
    },
  ];
  if (!destination) limitations.push("Nenhuma página real foi associada ao primeiro sitelink.");

  const callouts = verifiedCallouts(input).map((text, i) => ({ id: id("co", i + 1), text }));
  if (callouts.length === 0) {
    limitations.push("Sem preço, oferta ou garantia confirmados: não há destaques.");
  }

  const path1 = pathToken(p, 15);
  const path2Wanted = input.objective === "comparison" ? pathToken("compare", 15) : "";
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
    snippet: null,
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
    businessName: (input.brand || input.product).slice(0, 25),
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

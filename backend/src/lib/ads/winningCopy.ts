import type { AdGenerateInput, AdAngle, LocaleId } from "./adBundle";
import { adTextLength, canonicalProductName, normalizeAdText } from "./adText";

export type WinningLine = { text: string; angle: AdAngle };

type Lang = "en" | "pt" | "es" | "de" | "fr" | "it";

export type OfferSignals = {
  price: string | null;
  percent: string | null;
  saveAmount: string | null;
  guaranteeDays: string | null;
};

const MONEY = "(?:(?:US)?\\$|€|£|R\\$)\\s?\\d{1,5}(?:[.,]\\d{2})?";

function langOf(locale: LocaleId): Lang {
  if (locale.startsWith("pt")) return "pt";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("it")) return "it";
  return "en";
}

function notesText(input: AdGenerateInput): string {
  return [input.price_note, input.offer_note, input.guarantee_note, input.description, input.promotion?.value, input.promotion?.terms]
    .filter(Boolean)
    .join("\n");
}

/** Só devolve um valor que está escrito nas notas. Não completa o que falta. */
export function offerSignals(input: AdGenerateInput): OfferSignals {
  const text = notesText(input);
  const priceNote = normalizeAdText(input.price_note || "");
  const bare = new RegExp(`^(${MONEY})$`, "i");
  const priced = text.match(new RegExp(`\\b(?:just|only|costs|por|apenas|from)\\s+(${MONEY})\\b`, "i"));
  let price: string | null = null;
  if (bare.test(priceNote)) price = priceNote;
  else if (priced?.[1] && !/\boff\b/i.test(text.slice(priced.index ?? 0, (priced.index ?? 0) + priced[0].length + 6))) {
    price = normalizeAdText(priced[1]);
  }

  const percentFromPromo = input.promotion?.kind === "percent" ? input.promotion.value.replace("%", "").trim() : "";
  const percentMatch = text.match(/\b(\d{1,2})\s*%\s*(?:off|desconto|discount)\b/i);
  const percent = /^\d{1,2}$/.test(percentFromPromo) ? percentFromPromo : percentMatch?.[1] ?? null;

  const save = text.match(new RegExp(`\\b((?:up to\\s+)?${MONEY})\\s+off\\b`, "i"));
  const days = text.match(/\b(\d{1,3})\s*(?:day|days|dia|dias)\b/i);
  const guaranteeDays = days && /money[-\s]?back|guarantee|garantia|reembolso/i.test(text) ? days[1] : null;

  return {
    price,
    percent,
    saveAmount: save?.[1] ? normalizeAdText(save[1]) : null,
    guaranteeDays,
  };
}

function fit(value: string, max: number): string | null {
  const text = normalizeAdText(value);
  if (!text || adTextLength(text) > max) return null;
  return text;
}

const STOP = new Set([
  "the", "and", "for", "you", "your", "this", "that", "with", "from", "official", "website", "site",
  "money", "back", "guarantee", "today", "buy", "order", "free", "shipping", "days", "day", "only",
  "just", "get", "save", "special", "discount", "offer", "price", "off", "now", "here", "page",
  "before", "online", "have", "place", "official", "site",
]);

/** Uma frase da página só entra se falar deste produto e não for uma pergunta sobre outra marca. */
export function sentenceBelongsToProduct(sentence: string, product: string): boolean {
  if (sentence.includes("?")) return false;
  const name = canonicalProductName(product);
  const allowed = new Set(name.toLowerCase().split(" ").filter((word) => word.length >= 3));
  const caps = sentence.match(/\b[A-Z][A-Za-z0-9]{2,}\b/g) ?? [];
  for (const word of caps) {
    const lower = word.toLowerCase();
    if (allowed.has(lower) || STOP.has(lower)) continue;
    return false;
  }
  const tokens = [...allowed].filter((word) => word.length >= 4);
  if (tokens.length === 0) return true;
  const hay = sentence.toLowerCase();
  return tokens.some((word) => hay.includes(word));
}

type Bank = {
  official: (p: string) => string;
  buy: (p: string) => string;
  order: (p: string) => string;
  details: (p: string) => string;
  compare: (p: string) => string;
  purchaseOfficial: (p: string) => string;
  officialShort: string;
  buyShort: string;
  orderShort: string;
  descBuy: (p: string) => string;
  descOrder: (p: string) => string;
  descPrice: (p: string, price: string) => string;
  descPercent: (p: string, percent: string) => string;
  descSave: (p: string, amount: string) => string;
  descGuarantee: (p: string, days: string) => string;
  just: (p: string, price: string) => string;
  percent: (p: string, n: string) => string;
  percentToday: (n: string) => string;
  save: (amount: string) => string;
  guarantee: (days: string) => string;
};

const BANKS: Record<Lang, Bank> = {
  en: {
    official: (p) => `${p} Official Site`,
    buy: (p) => `Buy ${p}`,
    order: (p) => `Order ${p} Online`,
    details: (p) => `See ${p} Details`,
    compare: (p) => `Compare ${p}`,
    purchaseOfficial: (p) => `Purchase ${p} Official`,
    officialShort: "Official Site",
    buyShort: "Buy Online",
    orderShort: "Order Online",
    descBuy: (p) => `Buy ${p} now on the official website.`,
    descOrder: (p) => `Order ${p} on the official website before you buy.`,
    descPrice: (p, price) => `Order ${p} on the official website for ${price}.`,
    descPercent: (p, percent) => `Buy ${p} on the official website with ${percent}% off.`,
    descSave: (p, amount) => `Buy ${p} on the official website and save ${amount}.`,
    descGuarantee: (p, days) => `${days}-day money-back guarantee on ${p}. Order on the official website.`,
    just: (p, price) => `${p} Just ${price}`,
    percent: (p, n) => `${p} ${n}% Off`,
    percentToday: (n) => `Get ${n}% Off Today`,
    save: (amount) => `Save ${amount}`,
    guarantee: (days) => `${days} Day Money Back`,
  },
  pt: {
    official: (p) => `${p} Site Oficial`,
    buy: (p) => `Comprar ${p}`,
    order: (p) => `Encomendar ${p}`,
    details: (p) => `Ver ${p}`,
    compare: (p) => `Comparar ${p}`,
    purchaseOfficial: (p) => `${p} no site oficial`,
    officialShort: "Site oficial",
    buyShort: "Comprar online",
    orderShort: "Encomendar",
    descBuy: (p) => `Compre ${p} agora no site oficial.`,
    descOrder: (p) => `Encomende ${p} no site oficial e confira a oferta antes de comprar.`,
    descPrice: (p, price) => `Encomende ${p} no site oficial por ${price}.`,
    descPercent: (p, percent) => `Compre ${p} no site oficial com ${percent}% de desconto.`,
    descSave: (p, amount) => `Compre ${p} no site oficial e poupe ${amount}.`,
    descGuarantee: (p, days) => `Garantia de ${days} dias em ${p}. Encomende no site oficial.`,
    just: (p, price) => `${p} por ${price}`,
    percent: (p, n) => `${p} ${n}% off`,
    percentToday: (n) => `${n}% de desconto hoje`,
    save: (amount) => `Poupe ${amount}`,
    guarantee: (days) => `${days} dias de garantia`,
  },
  es: {
    official: (p) => `${p} Sitio Oficial`,
    buy: (p) => `Comprar ${p}`,
    order: (p) => `Pedir ${p} online`,
    details: (p) => `Ver ${p}`,
    compare: (p) => `Comparar ${p}`,
    purchaseOfficial: (p) => `${p} sitio oficial`,
    officialShort: "Sitio oficial",
    buyShort: "Comprar online",
    orderShort: "Pedir online",
    descBuy: (p) => `Compre ${p} ahora en el sitio oficial.`,
    descOrder: (p) => `Pida ${p} en el sitio oficial y revise la oferta antes de comprar.`,
    descPrice: (p, price) => `Pida ${p} en el sitio oficial por ${price}.`,
    descPercent: (p, percent) => `Compre ${p} en el sitio oficial con ${percent}% de descuento.`,
    descSave: (p, amount) => `Compre ${p} en el sitio oficial y ahorre ${amount}.`,
    descGuarantee: (p, days) => `Garantía de ${days} días en ${p}. Pídalo en el sitio oficial.`,
    just: (p, price) => `${p} por ${price}`,
    percent: (p, n) => `${p} ${n}% off`,
    percentToday: (n) => `${n}% de descuento hoy`,
    save: (amount) => `Ahorre ${amount}`,
    guarantee: (days) => `${days} días de garantía`,
  },
  de: {
    official: (p) => `${p} Offizielle Seite`,
    buy: (p) => `${p} kaufen`,
    order: (p) => `${p} online bestellen`,
    details: (p) => `${p} ansehen`,
    compare: (p) => `${p} vergleichen`,
    purchaseOfficial: (p) => `${p} offiziell kaufen`,
    officialShort: "Offizielle Seite",
    buyShort: "Online kaufen",
    orderShort: "Jetzt bestellen",
    descBuy: (p) => `${p} jetzt auf der offiziellen Seite kaufen.`,
    descOrder: (p) => `${p} auf der offiziellen Seite bestellen und das Angebot prüfen.`,
    descPrice: (p, price) => `${p} auf der offiziellen Seite für ${price} bestellen.`,
    descPercent: (p, percent) => `${p} auf der offiziellen Seite mit ${percent}% Rabatt kaufen.`,
    descSave: (p, amount) => `${p} auf der offiziellen Seite kaufen und ${amount} sparen.`,
    descGuarantee: (p, days) => `${days} Tage Geld-zurück-Garantie für ${p}. Bestellen Sie auf der offiziellen Seite.`,
    just: (p, price) => `${p} für ${price}`,
    percent: (p, n) => `${p} ${n}% Rabatt`,
    percentToday: (n) => `${n}% Rabatt heute`,
    save: (amount) => `${amount} sparen`,
    guarantee: (days) => `${days} Tage Garantie`,
  },
  fr: {
    official: (p) => `${p} Site Officiel`,
    buy: (p) => `Acheter ${p}`,
    order: (p) => `Commander ${p}`,
    details: (p) => `Voir ${p}`,
    compare: (p) => `Comparer ${p}`,
    purchaseOfficial: (p) => `${p} site officiel`,
    officialShort: "Site officiel",
    buyShort: "Acheter en ligne",
    orderShort: "Commander",
    descBuy: (p) => `Achetez ${p} maintenant sur le site officiel.`,
    descOrder: (p) => `Commandez ${p} sur le site officiel et vérifiez l'offre avant d'acheter.`,
    descPrice: (p, price) => `Commandez ${p} sur le site officiel pour ${price}.`,
    descPercent: (p, percent) => `Achetez ${p} sur le site officiel avec ${percent}% de réduction.`,
    descSave: (p, amount) => `Achetez ${p} sur le site officiel et économisez ${amount}.`,
    descGuarantee: (p, days) => `Garantie ${days} jours sur ${p}. Commandez sur le site officiel.`,
    just: (p, price) => `${p} à ${price}`,
    percent: (p, n) => `${p} ${n}% de réduction`,
    percentToday: (n) => `${n}% de réduction`,
    save: (amount) => `Économisez ${amount}`,
    guarantee: (days) => `Garantie ${days} jours`,
  },
  it: {
    official: (p) => `${p} Sito Ufficiale`,
    buy: (p) => `Compra ${p}`,
    order: (p) => `Ordina ${p}`,
    details: (p) => `Vedi ${p}`,
    compare: (p) => `Confronta ${p}`,
    purchaseOfficial: (p) => `${p} sito ufficiale`,
    officialShort: "Sito ufficiale",
    buyShort: "Compra online",
    orderShort: "Ordina online",
    descBuy: (p) => `Acquista ${p} ora sul sito ufficiale.`,
    descOrder: (p) => `Ordina ${p} sul sito ufficiale e controlla l'offerta prima di acquistare.`,
    descPrice: (p, price) => `Ordina ${p} sul sito ufficiale a ${price}.`,
    descPercent: (p, percent) => `Acquista ${p} sul sito ufficiale con il ${percent}% di sconto.`,
    descSave: (p, amount) => `Acquista ${p} sul sito ufficiale e risparmia ${amount}.`,
    descGuarantee: (p, days) => `Garanzia di ${days} giorni su ${p}. Ordina sul sito ufficiale.`,
    just: (p, price) => `${p} a ${price}`,
    percent: (p, n) => `${p} ${n}% di sconto`,
    percentToday: (n) => `${n}% di sconto oggi`,
    save: (amount) => `Risparmia ${amount}`,
    guarantee: (days) => `${days} giorni di garanzia`,
  },
};

function pushFit(out: WinningLine[], value: string, angle: AdAngle, max: number) {
  const text = fit(value, max);
  if (!text) return;
  if (out.some((line) => line.text.toLowerCase() === text.toLowerCase())) return;
  out.push({ text, angle });
}

export function winningHeadlines(input: AdGenerateInput, locale: LocaleId, max: number): WinningLine[] {
  const bank = BANKS[langOf(locale)];
  const p = canonicalProductName(input.brand?.trim() || input.product);
  const signals = offerSignals(input);
  const funnel = input.funnel;
  const out: WinningLine[] = [];
  const named =
    funnel === "TOP"
      ? [
          [bank.official(p), "brand"],
          [bank.details(p), "brand"],
          [bank.compare(p), "comparison"],
        ]
      : funnel === "MIDDLE" || input.objective === "comparison"
        ? [
            [bank.compare(p), "comparison"],
            [bank.official(p), "brand"],
            [bank.details(p), "brand"],
            [bank.buy(p), "purchase"],
          ]
        : [
            [bank.official(p), "brand"],
            [bank.buy(p), "purchase"],
            [bank.order(p), "purchase"],
            [bank.purchaseOfficial(p), "purchase"],
            [bank.details(p), "brand"],
          ];
  for (const [text, angle] of named) pushFit(out, text, angle as AdAngle, max);
  if (signals.price) pushFit(out, bank.just(p, signals.price), "offer", max);
  if (signals.percent) {
    pushFit(out, bank.percent(p, signals.percent), "offer", max);
    pushFit(out, bank.percentToday(signals.percent), "offer", max);
  }
  if (signals.saveAmount) pushFit(out, bank.save(signals.saveAmount), "offer", max);
  if (signals.guaranteeDays) pushFit(out, bank.guarantee(signals.guaranteeDays), "offer", max);
  if (out.length < 3) {
    for (const [text, angle] of [
      [bank.officialShort, "brand"],
      [bank.buyShort, "purchase"],
      [bank.orderShort, "purchase"],
    ] as const) {
      if (out.length >= 3) break;
      pushFit(out, text, angle, max);
    }
  }
  return out.slice(0, 12);
}

export function winningDescriptions(input: AdGenerateInput, locale: LocaleId, extraSentences: string[], max: number): string[] {
  const bank = BANKS[langOf(locale)];
  const full = canonicalProductName(input.brand?.trim() || input.product);
  const short = full.split(" ")[0] || full;
  const signals = offerSignals(input);
  const names = full === short ? [full] : [full, short];
  const out: string[] = [];
  const add = (value: string) => {
    const text = fit(value, max);
    if (!text) return;
    if (out.some((line) => line.toLowerCase() === text.toLowerCase())) return;
    out.push(text);
  };
  for (const name of names) {
    if (out.length >= 2) break;
    add(bank.descBuy(name));
    add(bank.descOrder(name));
  }
  for (const name of names) {
    if (signals.price) add(bank.descPrice(name, signals.price));
    if (signals.percent) add(bank.descPercent(name, signals.percent));
    if (signals.saveAmount) add(bank.descSave(name, signals.saveAmount));
    if (signals.guaranteeDays) add(bank.descGuarantee(name, signals.guaranteeDays));
  }
  for (const sentence of extraSentences) {
    if (!sentenceBelongsToProduct(sentence, full)) continue;
    add(sentence);
  }
  return out.slice(0, 4);
}

import type { AdGenerateInput, AdAngle, LocaleId } from "./adBundle";
import { adTextLength, adDisplayName, canonicalProductName, normalizeAdText } from "./adText";

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

  const saveOff = text.match(new RegExp(`\\b((?:up to\\s+)?${MONEY})\\s+off\\b`, "i"));
  const saveVerb = text.match(new RegExp(`\\b(?:you\\s+)?(?:save|poup[ae]|ahorr[ae]|spare)\\s+(${MONEY})`, "i"));
  const saveRaw = saveOff?.[1] || saveVerb?.[1] || "";
  const saveAmount = saveRaw ? normalizeAdText(saveRaw.match(new RegExp(MONEY, "i"))?.[0] || "") : null;
  const days = text.match(/\b(\d{1,3})\s*(?:day|days|dia|dias)\b/i);
  const guaranteeDays = days && /money[-\s]?back|guarantee|garantia|reembolso/i.test(text) ? days[1] : null;

  return {
    price,
    percent,
    saveAmount: saveAmount || null,
    guaranteeDays,
  };
}

function fit(value: string, max: number): string | null {
  const text = normalizeAdText(value);
  if (!text || adTextLength(text) > max) return null;
  if (/[()[\]]/.test(text)) return null;
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
    official: (p) => `${p} Offer`,
    buy: (p) => `Buy ${p}`,
    order: (p) => `See the Offer`,
    details: (p) => `About ${p}`,
    compare: (p) => `Compare ${p}`,
    purchaseOfficial: (p) => `View ${p} Offer`,
    officialShort: "See the Offer",
    buyShort: "Buy Online",
    orderShort: "View the Offer",
    descBuy: (p) => `See the ${p} offer before you buy.`,
    descOrder: (p) => `Open the ${p} offer and read the price there.`,
    descPrice: (p, price) => `The ${p} offer page shows ${price}.`,
    descPercent: (p, percent) => `The ${p} offer page shows ${percent}% off.`,
    descSave: (p, amount) => `The ${p} offer page says you save ${amount}.`,
    descGuarantee: (p, days) => `${days}-day money-back on ${p}. Read it on the offer page.`,
    just: (p, price) => `${p} Just ${price}`,
    percent: (p, n) => `${p} ${n}% Off Today`,
    percentToday: (n) => `Get ${n}% Off Today`,
    save: (amount) => `Save ${amount}`,
    guarantee: (days) => `${days} Day Money Back`,
  },
  pt: {
    official: (p) => `${p} Oferta`,
    buy: (p) => `Comprar ${p}`,
    order: (p) => `Ver a oferta`,
    details: (p) => `Sobre ${p}`,
    compare: (p) => `Comparar ${p}`,
    purchaseOfficial: (p) => `Ver oferta ${p}`,
    officialShort: "Ver a oferta",
    buyShort: "Comprar online",
    orderShort: "Abrir a oferta",
    descBuy: (p) => `Veja a oferta de ${p} antes de comprar.`,
    descOrder: (p) => `Abra a oferta de ${p} e leia o preço lá.`,
    descPrice: (p, price) => `A oferta de ${p} mostra ${price}.`,
    descPercent: (p, percent) => `A oferta de ${p} mostra ${percent}% de desconto.`,
    descSave: (p, amount) => `A oferta de ${p} diz que poupa ${amount}.`,
    descGuarantee: (p, days) => `Garantia de ${days} dias em ${p}. Leia na oferta.`,
    just: (p, price) => `${p} por ${price}`,
    percent: (p, n) => `${p} ${n}% off`,
    percentToday: (n) => `${n}% de desconto hoje`,
    save: (amount) => `Poupe ${amount}`,
    guarantee: (days) => `${days} dias de garantia`,
  },
  es: {
    official: (p) => `${p} Oferta`,
    buy: (p) => `Comprar ${p}`,
    order: (p) => `Ver la oferta`,
    details: (p) => `Sobre ${p}`,
    compare: (p) => `Comparar ${p}`,
    purchaseOfficial: (p) => `Ver oferta ${p}`,
    officialShort: "Ver la oferta",
    buyShort: "Comprar online",
    orderShort: "Abrir la oferta",
    descBuy: (p) => `Vea la oferta de ${p} antes de comprar.`,
    descOrder: (p) => `Abra la oferta de ${p} y lea el precio allí.`,
    descPrice: (p, price) => `La oferta de ${p} muestra ${price}.`,
    descPercent: (p, percent) => `La oferta de ${p} muestra ${percent}% de descuento.`,
    descSave: (p, amount) => `La oferta de ${p} dice que ahorra ${amount}.`,
    descGuarantee: (p, days) => `Garantía de ${days} días en ${p}. Léala en la oferta.`,
    just: (p, price) => `${p} por ${price}`,
    percent: (p, n) => `${p} ${n}% off`,
    percentToday: (n) => `${n}% de descuento hoy`,
    save: (amount) => `Ahorre ${amount}`,
    guarantee: (days) => `${days} días de garantía`,
  },
  de: {
    official: (p) => `${p} Angebot`,
    buy: (p) => `${p} kaufen`,
    order: (p) => `Angebot ansehen`,
    details: (p) => `${p} ansehen`,
    compare: (p) => `${p} vergleichen`,
    purchaseOfficial: (p) => `${p} Angebot sehen`,
    officialShort: "Angebot ansehen",
    buyShort: "Online kaufen",
    orderShort: "Angebot öffnen",
    descBuy: (p) => `Sehen Sie das Angebot für ${p}, bevor Sie kaufen.`,
    descOrder: (p) => `Öffnen Sie das Angebot für ${p} und lesen Sie den Preis dort.`,
    descPrice: (p, price) => `Das Angebot für ${p} zeigt ${price}.`,
    descPercent: (p, percent) => `Das Angebot für ${p} zeigt ${percent}% Rabatt.`,
    descSave: (p, amount) => `Das Angebot für ${p} nennt ${amount} Ersparnis.`,
    descGuarantee: (p, days) => `${days} Tage Garantie für ${p}. Lesen Sie sie im Angebot.`,
    just: (p, price) => `${p} für ${price}`,
    percent: (p, n) => `${p} ${n}% Rabatt`,
    percentToday: (n) => `${n}% Rabatt heute`,
    save: (amount) => `${amount} sparen`,
    guarantee: (days) => `${days} Tage Garantie`,
  },
  fr: {
    official: (p) => `${p} Offre`,
    buy: (p) => `Acheter ${p}`,
    order: (p) => `Voir l'offre`,
    details: (p) => `À propos de ${p}`,
    compare: (p) => `Comparer ${p}`,
    purchaseOfficial: (p) => `Voir l'offre ${p}`,
    officialShort: "Voir l'offre",
    buyShort: "Acheter en ligne",
    orderShort: "Ouvrir l'offre",
    descBuy: (p) => `Voyez l'offre ${p} avant d'acheter.`,
    descOrder: (p) => `Ouvrez l'offre ${p} et lisez le prix là-bas.`,
    descPrice: (p, price) => `L'offre ${p} affiche ${price}.`,
    descPercent: (p, percent) => `L'offre ${p} affiche ${percent}% de réduction.`,
    descSave: (p, amount) => `L'offre ${p} indique une économie de ${amount}.`,
    descGuarantee: (p, days) => `Garantie de ${days} jours sur ${p}. Lisez-la dans l'offre.`,
    just: (p, price) => `${p} à ${price}`,
    percent: (p, n) => `${p} ${n}% de réduction`,
    percentToday: (n) => `${n}% de réduction`,
    save: (amount) => `Économisez ${amount}`,
    guarantee: (days) => `Garantie ${days} jours`,
  },
  it: {
    official: (p) => `${p} Offerta`,
    buy: (p) => `Compra ${p}`,
    order: (p) => `Vedi l'offerta`,
    details: (p) => `Informazioni su ${p}`,
    compare: (p) => `Confronta ${p}`,
    purchaseOfficial: (p) => `Vedi offerta ${p}`,
    officialShort: "Vedi l'offerta",
    buyShort: "Compra online",
    orderShort: "Apri l'offerta",
    descBuy: (p) => `Guarda l'offerta di ${p} prima di acquistare.`,
    descOrder: (p) => `Apri l'offerta di ${p} e leggi il prezzo lì.`,
    descPrice: (p, price) => `L'offerta di ${p} mostra ${price}.`,
    descPercent: (p, percent) => `L'offerta di ${p} mostra il ${percent}% di sconto.`,
    descSave: (p, amount) => `L'offerta di ${p} indica un risparmio di ${amount}.`,
    descGuarantee: (p, days) => `Garanzia di ${days} giorni su ${p}. Leggila nell'offerta.`,
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
  const p = adDisplayName(input.brand?.trim() || input.product);
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
  if (signals.saveAmount) {
    pushFit(out, bank.save(signals.saveAmount), "offer", max);
    pushFit(out, `Buy Here and Save ${signals.saveAmount}`, "offer", max);
  }
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
  const full = adDisplayName(input.brand?.trim() || input.product);
  const short = full.split(" ")[0] || full;
  const signals = offerSignals(input);
  const out: string[] = [];
  const add = (value: string) => {
    const text = fit(value, max);
    if (!text) return;
    if (out.some((line) => line.toLowerCase() === text.toLowerCase())) return;
    out.push(text);
  };
  add(bank.descBuy(full));
  add(bank.descOrder(full));
  if (langOf(locale) === "en") add(`Open the ${full} offer page.`);
  if (out.length < 2 && short !== full) {
    add(bank.descBuy(short));
    add(bank.descOrder(short));
  }
  if (signals.price) add(bank.descPrice(full, signals.price));
  if (signals.percent) add(bank.descPercent(full, signals.percent));
  if (signals.saveAmount) add(bank.descSave(full, signals.saveAmount));
  if (signals.guaranteeDays) add(bank.descGuarantee(full, signals.guaranteeDays));
  for (const sentence of extraSentences) {
    if (!sentenceBelongsToProduct(sentence, full)) continue;
    add(sentence);
  }
  return out.slice(0, 4);
}

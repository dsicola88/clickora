/** Códigos canónicos alinhados à criação da presell e ao seletor do visitante. */
export type PresellLocaleKey =
  | "en"
  | "es"
  | "pt-BR"
  | "de"
  | "fr"
  | "it"
  | "pl"
  | "tr"
  | "hi"
  | "ar"
  | "nl"
  | "sv"
  | "no"
  | "da";

export const PRESHELL_LOCALE_KEYS: PresellLocaleKey[] = [
  "pl",
  "tr",
  "hi",
  "ar",
  "nl",
  "sv",
  "no",
  "da",
  "fr",
  "it",
  "pt-BR",
  "en",
  "es",
  "de",
];

/** Lista para o formulário de criação (ordem pedida). */
export const PRESELL_CREATION_LANGUAGES: { id: PresellLocaleKey; name: string }[] = [
  { id: "pl", name: "Polonês (PL)" },
  { id: "tr", name: "Turco (TR)" },
  { id: "hi", name: "Hindi (HI)" },
  { id: "ar", name: "Árabe (AR)" },
  { id: "nl", name: "Holandês (NL)" },
  { id: "sv", name: "Sueco (SV)" },
  { id: "no", name: "Norueguês (NO)" },
  { id: "da", name: "Dinamarquês (DA)" },
  { id: "fr", name: "Francês (FR)" },
  { id: "it", name: "Italiano (IT)" },
  { id: "pt-BR", name: "Português (PT-BR)" },
  { id: "en", name: "Inglês (EN)" },
  { id: "es", name: "Espanhol (ES)" },
  { id: "de", name: "Alemão (DE)" },
];

export type PresellUiStrings = {
  beforeContinue: string;
  ageLabel: string;
  /** Usar `{min}` como placeholder. */
  ageInvalid: string;
  sexLabel: string;
  sexM: string;
  sexF: string;
  sexO: string;
  groupLabel: string;
  countryLabel: string;
  captchaLabel: string;
  modelLabel: string;
  modelA: string;
  modelB: string;
  modelC: string;
  cookieTitle: string;
  cookieBody: string;
  cookieAllow: string;
  cookieClose: string;
  cookieFooter: string;
  cookieReopen: string;
  cookieBar: string;
  cookieAccept: string;
  cookiePolicy: string;
  midCta: string;
  /** Texto neutro para o visitante (sem mencionar afiliado ou rastreamento). */
  footerNote: string;
  discountUrgency: string;
  discountSocial: string;
  presentationLabel: string;
};

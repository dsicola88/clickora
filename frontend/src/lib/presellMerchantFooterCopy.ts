import type { PresellLocaleKey } from "./presellUiStrings.types";

type MerchantFooterCopy = {
  section: string;
  privacy: string;
  terms: string;
  refund: string;
  shipping: string;
  operatorPrivacy: string;
  operatorTerms: string;
};

const COPY: Record<PresellLocaleKey, MerchantFooterCopy> = {
  en: {
    section: "Merchant site (official — for reference before you buy)",
    privacy: "Merchant privacy policy",
    terms: "Merchant terms",
    refund: "Merchant refunds",
    shipping: "Merchant shipping",
    operatorPrivacy: "Privacy (this affiliate page)",
    operatorTerms: "Terms (this affiliate page)",
  },
  "pt-BR": {
    section: "Site do comerciante (oficial — só para consulta antes de comprar)",
    privacy: "Privacidade do vendedor",
    terms: "Termos do vendedor",
    refund: "Devoluções do vendedor",
    shipping: "Envio do vendedor",
    operatorPrivacy: "Privacidade (esta página de afiliado)",
    operatorTerms: "Termos (esta página de afiliado)",
  },
  es: {
    section: "Sitio del comerciante (oficial — solo consulta)",
    privacy: "Privacidad del vendedor",
    terms: "Términos del vendedor",
    refund: "Devoluciones del vendedor",
    shipping: "Envíos del vendedor",
    operatorPrivacy: "Privacidad (esta página de afiliado)",
    operatorTerms: "Términos (esta página de afiliado)",
  },
  de: {
    section: "Händlerseite (offiziell — nur zur Information)",
    privacy: "Datenschutz des Händlers",
    terms: "AGB des Händlers",
    refund: "Rückgabe beim Händler",
    shipping: "Versand des Händlers",
    operatorPrivacy: "Datenschutz (diese Affiliate-Seite)",
    operatorTerms: "AGB (diese Affiliate-Seite)",
  },
  fr: {
    section: "Site marchand (officiel — consultation)",
    privacy: "Confidentialité du vendeur",
    terms: "Conditions du vendeur",
    refund: "Remboursements du vendeur",
    shipping: "Livraison du vendeur",
    operatorPrivacy: "Confidentialité (cette page affiliée)",
    operatorTerms: "Conditions (cette page affiliée)",
  },
  it: {
    section: "Sito del commerciante (ufficiale — solo consultazione)",
    privacy: "Privacy del venditore",
    terms: "Termini del venditore",
    refund: "Resi del venditore",
    shipping: "Spedizione del venditore",
    operatorPrivacy: "Privacy (questa pagina affiliata)",
    operatorTerms: "Termini (questa pagina affiliata)",
  },
  pl: {
    section: "Strona sprzedawcy (oficjalna — do wglądu)",
    privacy: "Polityka prywatności sprzedawcy",
    terms: "Regulamin sprzedawcy",
    refund: "Zwroty u sprzedawcy",
    shipping: "Wysyłka sprzedawcy",
    operatorPrivacy: "Prywatność (ta strona afiliacyjna)",
    operatorTerms: "Regulamin (ta strona afiliacyjna)",
  },
  tr: {
    section: "Satıcı sitesi (resmî — bilgi amaçlı)",
    privacy: "Satıcı gizlilik politikası",
    terms: "Satıcı şartları",
    refund: "Satıcı iade politikası",
    shipping: "Satıcı kargo",
    operatorPrivacy: "Gizlilik (bu affiliate sayfası)",
    operatorTerms: "Şartlar (bu affiliate sayfası)",
  },
  hi: {
    section: "विक्रेता की आधिकारिक साइट (केवल संदर्भ)",
    privacy: "विक्रेता गोपनीयता",
    terms: "विक्रेता शर्तें",
    refund: "विक्रेता रिफंड",
    shipping: "विक्रेता शिपिंग",
    operatorPrivacy: "गोपनीयता (यह affiliate पेज)",
    operatorTerms: "शर्तें (यह affiliate पेज)",
  },
  ar: {
    section: "موقع التاجر (رسمي — للمراجعة فقط)",
    privacy: "خصوصية التاجر",
    terms: "شروط التاجر",
    refund: "استرداد التاجر",
    shipping: "شحن التاجر",
    operatorPrivacy: "الخصوصية (صفحة الإ affiliate)",
    operatorTerms: "الشروط (صفحة الإ affiliate)",
  },
  nl: {
    section: "Site van de verkoper (officieel — ter informatie)",
    privacy: "Privacy verkoper",
    terms: "Voorwaarden verkoper",
    refund: "Retourneren bij verkoper",
    shipping: "Verzending verkoper",
    operatorPrivacy: "Privacy (deze affiliatepagina)",
    operatorTerms: "Voorwaarden (deze affiliatepagina)",
  },
  sv: {
    section: "Handlarens webbplats (officiell — endast information)",
    privacy: "Handlarens integritet",
    terms: "Handlarens villkor",
    refund: "Handlarens returer",
    shipping: "Handlarens frakt",
    operatorPrivacy: "Integritet (denna affiliate-sida)",
    operatorTerms: "Villkor (denna affiliate-sida)",
  },
  no: {
    section: "Selgerens nettsted (offisielt — til orientering)",
    privacy: "Selgerens personvern",
    terms: "Selgerens vilkår",
    refund: "Selgerens retur",
    shipping: "Selgerens frakt",
    operatorPrivacy: "Personvern (denne affiliate-siden)",
    operatorTerms: "Vilkår (denne affiliate-siden)",
  },
  da: {
    section: "Forhandlerens site (officielt — til reference)",
    privacy: "Forhandlerens privatliv",
    terms: "Forhandlerens vilkår",
    refund: "Forhandlerens returnering",
    shipping: "Forhandlerens fragt",
    operatorPrivacy: "Privatliv (denne affiliate-side)",
    operatorTerms: "Vilkår (denne affiliate-side)",
  },
};

export function merchantFooterCopy(locale: PresellLocaleKey): MerchantFooterCopy {
  return COPY[locale] ?? COPY.en;
}

export function merchantLinkLabel(
  locale: PresellLocaleKey,
  id: "merchantPrivacy" | "merchantTerms" | "merchantRefund" | "merchantShipping",
): string {
  const c = merchantFooterCopy(locale);
  return c[id === "merchantPrivacy" ? "privacy" : id === "merchantTerms" ? "terms" : id === "merchantRefund" ? "refund" : "shipping"];
}

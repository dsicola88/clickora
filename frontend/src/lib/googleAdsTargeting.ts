/**
 * Países e idiomas suportados pelo publish Google Ads.
 * Códigos ISO‑2 por país alinham com `backend/src/paid/geo-google.ts` e `language-google.ts`
 * (normalização no plano e na publicação).
 */
export type TargetingOption = { code: string; label: string };

/** Espelha ISO_GEO — apenas estes códios são aceites na publicação Google. */
export const GOOGLE_ADS_COUNTRY_OPTIONS: TargetingOption[] = [
  { code: "BR", label: "Brasil" },
  { code: "PT", label: "Portugal" },
  { code: "US", label: "Estados Unidos" },
  { code: "CA", label: "Canadá" },
  { code: "GB", label: "Reino Unido" },
  { code: "AU", label: "Austrália" },
  { code: "DE", label: "Alemanha" },
  { code: "FR", label: "França" },
  { code: "IT", label: "Itália" },
  { code: "ES", label: "Espanha" },
  { code: "NL", label: "Países Baixos" },
  { code: "BE", label: "Bélgica" },
  { code: "CH", label: "Suíça" },
  { code: "AT", label: "Áustria" },
  { code: "SE", label: "Suécia" },
  { code: "NO", label: "Noruega" },
  { code: "DK", label: "Dinamarca" },
  { code: "FI", label: "Finlândia" },
  { code: "PL", label: "Polónia" },
  { code: "CZ", label: "República Checa" },
  { code: "IE", label: "Irlanda" },
  { code: "GR", label: "Grécia" },
  { code: "TR", label: "Turquia" },
  { code: "IN", label: "Índia" },
  { code: "JP", label: "Japão" },
  { code: "MX", label: "México" },
  { code: "AR", label: "Argentina" },
  { code: "AO", label: "Angola" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colômbia" },
  { code: "NZ", label: "Nova Zelândia" },
  { code: "ZA", label: "África do Sul" },
  { code: "SG", label: "Singapura" },
  { code: "MY", label: "Malásia" },
  { code: "TH", label: "Tailândia" },
  { code: "PH", label: "Filipinas" },
  { code: "ID", label: "Indonésia" },
  { code: "VN", label: "Vietname" },
  { code: "RO", label: "Roménia" },
].sort((a, b) => a.label.localeCompare(b.label, "pt"));

/** Espelha LANG_ID — códigos aceites na API Google Ads (language constants). */
export const GOOGLE_ADS_LANGUAGE_OPTIONS: TargetingOption[] = [
  { code: "pt", label: "Português" },
  { code: "en", label: "Inglês" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
  { code: "de", label: "Alemão" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Neerlandês" },
  { code: "pl", label: "Polaco" },
  { code: "sv", label: "Sueco" },
  { code: "da", label: "Dinamarquês" },
  { code: "fi", label: "Finlandês" },
  { code: "no", label: "Norueguês" },
  { code: "cs", label: "Checo" },
  { code: "el", label: "Grego" },
  { code: "hu", label: "Húngaro" },
  { code: "ro", label: "Romeno" },
  { code: "ru", label: "Russo" },
  { code: "tr", label: "Turco" },
  { code: "ja", label: "Japonês" },
  { code: "ko", label: "Coreano" },
  { code: "zh", label: "Chinês (trad.)" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Árabe" },
].sort((a, b) => a.label.localeCompare(b.label, "pt"));

export function countryLabel(code: string): string {
  const u = code.toUpperCase();
  return GOOGLE_ADS_COUNTRY_OPTIONS.find((o) => o.code === u)?.label ?? u;
}

export function languageLabel(code: string): string {
  const low = code.toLowerCase();
  return GOOGLE_ADS_LANGUAGE_OPTIONS.find((o) => o.code === low)?.label ?? code;
}

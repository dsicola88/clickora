/** Mercados típicos por idioma do anúncio (Search internacional). */
const MARKET_CODES_BY_LANGUAGE: Record<string, string[]> = {
  en: ["US", "GB", "CA", "AU", "IE", "NZ", "IN", "PH", "ZA", "NG"],
  pt: ["BR", "PT", "AO"],
  es: ["MX", "ES", "AR", "CO", "CL"],
  fr: ["FR", "CA"],
  de: ["DE", "AT", "CH"],
  it: ["IT"],
};

export const GRINGA_AFFILIATE_PLATFORMS = new Set([
  "clickbank",
  "buygoods",
  "digistore24",
  "maxweb",
  "smartadv",
  "warriorplus",
]);

export function marketsForLanguage(
  language: string,
  all: { code: string; name: string }[],
): { code: string; name: string }[] {
  const codes = MARKET_CODES_BY_LANGUAGE[language];
  if (!codes?.length) return all;
  const picked = all.filter((m) => codes.includes(m.code));
  return picked.length ? picked : all;
}

export function defaultMarketForLanguage(language: string): string {
  if (language === "en") return "US";
  if (language === "pt") return "BR";
  if (language === "es") return "MX";
  if (language === "fr") return "FR";
  if (language === "de") return "DE";
  if (language === "it") return "IT";
  return "US";
}

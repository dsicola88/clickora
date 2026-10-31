/** Locales do painel da app (i18n ponta a ponta). Landers públicas usam `presellUiStrings` à parte. */
export type AppLocale = "en" | "pt" | "pt-BR" | "es";

export const APP_LOCALES: readonly AppLocale[] = ["en", "pt", "pt-BR", "es"] as const;

export const APP_LOCALE_STORAGE_KEY = "clickora:app-locale";

export const APP_LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  pt: "Português (Portugal)",
  "pt-BR": "Português (Brasil)",
  es: "Español",
};

/** BCP 47 para `<html lang>`. */
export function htmlLangForAppLocale(locale: AppLocale): string {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "pt") return "pt-PT";
  if (locale === "es") return "es";
  return "en";
}

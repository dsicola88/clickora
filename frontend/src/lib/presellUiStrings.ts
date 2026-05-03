import type { PresellLocaleKey, PresellUiStrings } from "./presellUiStrings.types";
import { PRESHELL_UI_STRINGS } from "./presellUiStrings.locales";

export type { PresellLocaleKey, PresellUiStrings } from "./presellUiStrings.types";
export {
  PRESELL_CREATION_LANGUAGES,
  PRESHELL_LOCALE_KEYS,
} from "./presellUiStrings.types";

/** Links do header tipo landing escura (suplemento / oferta). */
export function darkStorefrontNavLabels(lang: PresellLocaleKey): {
  about: string;
  ingredients: string;
  faq: string;
} {
  switch (lang) {
    case "pt-BR":
      return { about: "Sobre", ingredients: "Ingredientes", faq: "FAQ" };
    case "es":
      return { about: "Acerca de", ingredients: "Ingredientes", faq: "FAQ" };
    case "fr":
      return { about: "À propos", ingredients: "Ingrédients", faq: "FAQ" };
    case "de":
      return { about: "Über", ingredients: "Inhaltsstoffe", faq: "FAQ" };
    case "it":
      return { about: "Informazioni", ingredients: "Ingredienti", faq: "FAQ" };
    case "pl":
      return { about: "O produkcie", ingredients: "Składniki", faq: "FAQ" };
    case "tr":
      return { about: "Hakkında", ingredients: "İçindekiler", faq: "SSS" };
    case "nl":
      return { about: "Over", ingredients: "Ingrediënten", faq: "FAQ" };
    case "sv":
    case "no":
    case "da":
      return { about: "Om", ingredients: "Ingredienser", faq: "FAQ" };
    case "hi":
      return { about: "परिचय", ingredients: "घटक", faq: "FAQ" };
    case "ar":
      return { about: "نبذة", ingredients: "المكونات", faq: "الأسئلة" };
    default:
      return { about: "About", ingredients: "Ingredients", faq: "FAQ" };
  }
}

/** Normaliza códigos guardados (pt, pt-br, pt_BR…) e prefixos do navegador (en-US → en). */
export function normalizePresellLocale(raw: string | undefined): PresellLocaleKey {
  const r = (raw || "pt-BR").trim().toLowerCase().replace(/_/g, "-");
  if (!r || r === "pt") return "pt-BR";
  if (r === "us" || r === "en" || r.startsWith("en-")) return "en";
  if (r.startsWith("es")) return "es";
  if (r.startsWith("pt-br") || r === "pt-br") return "pt-BR";
  if (r.startsWith("de")) return "de";
  if (r.startsWith("fr")) return "fr";
  if (r.startsWith("it")) return "it";
  if (r.startsWith("pl")) return "pl";
  if (r.startsWith("tr")) return "tr";
  if (r.startsWith("hi")) return "hi";
  if (r.startsWith("ar")) return "ar";
  if (r.startsWith("nl")) return "nl";
  if (r.startsWith("sv")) return "sv";
  if (r === "no" || r.startsWith("nb") || r.startsWith("nn")) return "no";
  if (r.startsWith("da")) return "da";
  return "pt-BR";
}

export function getPresellUiStrings(raw: string | undefined): PresellUiStrings {
  return PRESHELL_UI_STRINGS[normalizePresellLocale(raw)];
}

export function isRtlLocale(locale: PresellLocaleKey): boolean {
  return locale === "ar";
}

/** Atributo `lang` em HTML (BCP 47). */
export function htmlLangForLocale(locale: PresellLocaleKey): string {
  switch (locale) {
    case "pt-BR":
      return "pt-BR";
    case "no":
      return "nb-NO";
    default:
      return locale;
  }
}

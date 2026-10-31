import { en, type AppMessages } from "./messages/en";
import { pt } from "./messages/pt";
import { ptBR } from "./messages/pt-BR";
import type { AppLocale } from "./types";
import { APP_LOCALE_STORAGE_KEY, htmlLangForAppLocale } from "./types";

export type { AppMessages };
export type { AppLocale } from "./types";
export {
  APP_LOCALES,
  APP_LOCALE_LABELS,
  APP_LOCALE_STORAGE_KEY,
  htmlLangForAppLocale,
} from "./types";

const catalogs: Record<AppLocale, AppMessages> = {
  en,
  pt,
  "pt-BR": ptBR,
};

export function normalizeAppLocale(raw: string | null | undefined): AppLocale {
  const r = (raw || "").trim();
  if (r === "en" || r.toLowerCase().startsWith("en")) return "en";
  if (r === "pt-BR" || r === "pt_BR" || r.toLowerCase() === "pt-br") return "pt-BR";
  if (r === "pt" || r.toLowerCase().startsWith("pt-pt") || r.toLowerCase() === "pt-pt") return "pt";
  // Default for Lusophone product: European PT (painel histórico); BR opt-in.
  if (r.toLowerCase().startsWith("pt")) return "pt";
  return "pt";
}

export function readStoredAppLocale(): AppLocale {
  try {
    return normalizeAppLocale(localStorage.getItem(APP_LOCALE_STORAGE_KEY));
  } catch {
    return "pt";
  }
}

export function detectBrowserAppLocale(): AppLocale {
  try {
    const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
    if (nav.toLowerCase().startsWith("en")) return "en";
    if (nav.toLowerCase() === "pt-br" || nav.toLowerCase().startsWith("pt-br")) return "pt-BR";
    if (nav.toLowerCase().startsWith("pt")) return "pt";
  } catch {
    /* ignore */
  }
  return "pt";
}

export function resolveInitialAppLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(APP_LOCALE_STORAGE_KEY);
    if (stored) return normalizeAppLocale(stored);
  } catch {
    /* ignore */
  }
  return detectBrowserAppLocale();
}

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = htmlLangForAppLocale(locale);
}

type LeafPaths<T, P extends string = ""> = T extends string
  ? P
  : {
      [K in keyof T & string]: LeafPaths<T[K], P extends "" ? K : `${P}.${K}`>;
    }[keyof T & string];

export type MessageKey = LeafPaths<AppMessages>;

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(locale: AppLocale, key: MessageKey): string {
  const hit = getByPath(catalogs[locale], key) ?? getByPath(en, key);
  if (hit) return hit;
  if (import.meta.env.DEV) {
    console.warn(`[i18n] missing key: ${key}`);
  }
  return key;
}

export function messagesFor(locale: AppLocale): AppMessages {
  return catalogs[locale] ?? en;
}

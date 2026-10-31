import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDocumentLocale,
  messagesFor,
  resolveInitialAppLocale,
  translate,
  type MessageKey,
} from "./index";
import type { AppLocale } from "./types";
import { APP_LOCALE_STORAGE_KEY } from "./types";
import type { AppMessages } from "./messages/en";

type AppLocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: MessageKey) => string;
  m: AppMessages;
};

const AppLocaleContext = createContext<AppLocaleContextValue | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => resolveInitialAppLocale());

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(APP_LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyDocumentLocale(next);
  }, []);

  const value = useMemo<AppLocaleContextValue>(() => {
    const m = messagesFor(locale);
    return {
      locale,
      setLocale,
      t: (key) => translate(locale, key),
      m,
    };
  }, [locale, setLocale]);

  return <AppLocaleContext.Provider value={value}>{children}</AppLocaleContext.Provider>;
}

export function useAppLocale(): AppLocaleContextValue {
  const ctx = useContext(AppLocaleContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within AppLocaleProvider");
  }
  return ctx;
}

/** Safe for components that may render outside provider (fallback PT). */
export function useAppLocaleOptional(): AppLocaleContextValue | null {
  return useContext(AppLocaleContext);
}

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
import { translateLegacyPt } from "./legacyBridge";
import type { AppLocale } from "./types";
import { APP_LOCALE_STORAGE_KEY } from "./types";
import type { AppMessages } from "./messages/en";
import { toast } from "sonner";

type AppLocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: MessageKey) => string;
  /** Translate a leftover Portuguese UI literal for the active locale. */
  tx: (portugueseText: string) => string;
  m: AppMessages;
};

type ToastFn = typeof toast.success;
let toastPatched = false;
const toastOriginals: Partial<Record<"success" | "error" | "message" | "warning" | "info", ToastFn>> = {};

function patchToast(tx: (s: string) => string) {
  const wrap =
    (orig: ToastFn): ToastFn =>
    (message, data) => {
      if (typeof message === "string") return orig(tx(message), data);
      return orig(message, data);
    };
  if (!toastPatched) {
    toastOriginals.success = toast.success.bind(toast);
    toastOriginals.error = toast.error.bind(toast);
    toastOriginals.message = toast.message.bind(toast);
    toastOriginals.warning = toast.warning.bind(toast);
    toastOriginals.info = toast.info.bind(toast);
    toastPatched = true;
  }
  toast.success = wrap(toastOriginals.success!);
  toast.error = wrap(toastOriginals.error!);
  toast.message = wrap(toastOriginals.message!);
  toast.warning = wrap(toastOriginals.warning!);
  toast.info = wrap(toastOriginals.info!);
}

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

  const tx = useCallback((portugueseText: string) => translateLegacyPt(locale, portugueseText), [locale]);

  useEffect(() => {
    patchToast(tx);
  }, [tx]);

  const value = useMemo<AppLocaleContextValue>(() => {
    const m = messagesFor(locale);
    return {
      locale,
      setLocale,
      t: (key) => translate(locale, key),
      tx,
      m,
    };
  }, [locale, setLocale, tx]);

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

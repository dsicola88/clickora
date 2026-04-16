import { useCallback, useEffect, useMemo, useState } from "react";
import type { PresellLocaleKey } from "./presellUiStrings.types";
import { PRESHELL_LOCALE_KEYS } from "./presellUiStrings.types";
import { normalizePresellLocale } from "./presellUiStrings";

const STORAGE_PREFIX = "presell_ui_lang:";

export function readVisitorOverride(pageId: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + pageId);
  } catch {
    return null;
  }
}

export function writeVisitorOverride(pageId: string, value: string | null): void {
  try {
    const key = STORAGE_PREFIX + pageId;
    if (value === null || value === "") sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

function isLocaleKey(s: string): s is PresellLocaleKey {
  return (PRESHELL_LOCALE_KEYS as readonly string[]).includes(s);
}

/**
 * - Sem override na sessão: usa o idioma definido pelo criador na presell.
 * - `auto`: usa o idioma do navegador (normalizado para um dos idiomas suportados).
 * - Qualquer código canónico (en, pt-BR, de…): escolha explícita do visitante.
 */
export function resolveEffectiveUiLang(
  presellLang: string | undefined,
  browserLang: string | undefined,
  override: string | null,
): PresellLocaleKey {
  if (override && override !== "auto" && isLocaleKey(override)) return override;
  if (override === "auto") return normalizePresellLocale(browserLang);
  return normalizePresellLocale(presellLang);
}

export type PresellUiMode = "default" | "auto" | PresellLocaleKey;

export function overrideToMode(override: string | null): PresellUiMode {
  if (override === null || override === undefined || override === "") return "default";
  if (override === "auto") return "auto";
  if (isLocaleKey(override)) return override;
  return "default";
}

export function usePresellUiLanguage(pageId: string | undefined, presellLang: string | undefined) {
  const [override, setOverrideState] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    setStorageReady(false);
    if (!pageId) {
      setOverrideState(null);
      return;
    }
    setOverrideState(readVisitorOverride(pageId));
    setStorageReady(true);
  }, [pageId]);

  const browserLang = typeof navigator !== "undefined" ? navigator.language : "pt-BR";

  const resolved = useMemo(
    () =>
      resolveEffectiveUiLang(
        presellLang,
        browserLang,
        storageReady ? override : null,
      ),
    [presellLang, browserLang, override, storageReady],
  );

  const setMode = useCallback(
    (mode: PresellUiMode) => {
      if (!pageId) return;
      if (mode === "default") {
        writeVisitorOverride(pageId, null);
        setOverrideState(null);
        return;
      }
      if (mode === "auto") {
        writeVisitorOverride(pageId, "auto");
        setOverrideState("auto");
        return;
      }
      writeVisitorOverride(pageId, mode);
      setOverrideState(mode);
    },
    [pageId],
  );

  return {
    resolved,
    override: storageReady ? override : null,
    setMode,
    browserLang,
  };
}

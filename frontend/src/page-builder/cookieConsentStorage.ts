/** Persistência do consentimento do banner (mesma aba + refresh). */

export type StoredCookieConsent = "all" | "essential";

const CHOICE_SUFFIX = ":choice";
export const COOKIE_CONSENT_EVENT = "clickora-cookie-consent";
export const DEFAULT_COOKIE_CONSENT_STORAGE_KEY = "clickora-cookie-banner";

export type CookieConsentEventDetail = {
  storageKey: string;
  /** null = escolha retirada (reabrir banner). */
  choice: StoredCookieConsent | null;
};

export function cookieConsentChoiceKey(storageKey: string): string {
  return `${storageKey.trim() || DEFAULT_COOKIE_CONSENT_STORAGE_KEY}${CHOICE_SUFFIX}`;
}

export function readCookieConsentChoice(
  storageKey = DEFAULT_COOKIE_CONSENT_STORAGE_KEY,
): StoredCookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(cookieConsentChoiceKey(storageKey));
    if (v === "all" || v === "essential") return v;
    // Legado: só «dismissed» sem choice → essenciais (página OK, sem ads).
    if (window.localStorage.getItem(storageKey) === "1") return "essential";
  } catch {
    /* private mode */
  }
  return null;
}

export function writeCookieConsentChoice(
  storageKey: string,
  choice: StoredCookieConsent,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey.trim() || DEFAULT_COOKIE_CONSENT_STORAGE_KEY;
  try {
    window.localStorage.setItem(key, "1");
    window.localStorage.setItem(cookieConsentChoiceKey(key), choice);
    window.dispatchEvent(
      new CustomEvent<CookieConsentEventDetail>(COOKIE_CONSENT_EVENT, {
        detail: { storageKey: key, choice },
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Retira a escolha — o banner pode voltar; marketing deve desligar até nova decisão. */
export function clearCookieConsentChoice(
  storageKey = DEFAULT_COOKIE_CONSENT_STORAGE_KEY,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey.trim() || DEFAULT_COOKIE_CONSENT_STORAGE_KEY;
  try {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(cookieConsentChoiceKey(key));
    window.dispatchEvent(
      new CustomEvent<CookieConsentEventDetail>(COOKIE_CONSENT_EVENT, {
        detail: { storageKey: key, choice: null },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function isMarketingConsentGranted(
  choice: StoredCookieConsent | null | undefined,
): boolean {
  return choice === "all";
}

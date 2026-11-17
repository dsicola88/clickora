/** Persistência do consentimento do banner (mesma aba + refresh). */

export type StoredCookieConsent = "all" | "essential";

const CHOICE_SUFFIX = ":choice";
export const COOKIE_CONSENT_EVENT = "clickora-cookie-consent";

export function cookieConsentChoiceKey(storageKey: string): string {
  return `${storageKey.trim() || "clickora-cookie-banner"}${CHOICE_SUFFIX}`;
}

export function readCookieConsentChoice(storageKey = "clickora-cookie-banner"): StoredCookieConsent | null {
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
  const key = storageKey.trim() || "clickora-cookie-banner";
  try {
    window.localStorage.setItem(key, "1");
    window.localStorage.setItem(cookieConsentChoiceKey(key), choice);
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { storageKey: key, choice } }),
    );
  } catch {
    /* ignore */
  }
}

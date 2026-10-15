import { PRESHELL_UI_STRINGS } from "@/lib/presellUiStrings.locales";
import { getPresellUiStrings } from "@/lib/presellUiStrings";

const STOCK_TITLES = new Set(
  Object.values(PRESHELL_UI_STRINGS).map((s) => s.cookieTitle.trim()),
);

export type CookieBannerCopyInput = {
  title?: string;
  body?: string;
  allowLabel?: string;
  declineLabel?: string;
  policyLabel?: string;
  /** false = o texto gravado no widget manda. true ou ausente com título de stock = idioma da página. */
  followLanguage?: boolean;
};

export type CookieBannerCopy = {
  title: string;
  body: string;
  allowLabel: string;
  declineLabel: string;
  policyLabel: string;
  followsLanguage: boolean;
};

export function cookieBannerFollowsPageLanguage(content: CookieBannerCopyInput): boolean {
  if (content.followLanguage === false) return false;
  if (content.followLanguage === true) return true;
  const title = (content.title ?? "").trim();
  if (!title) return true;
  return STOCK_TITLES.has(title);
}

export function resolveCookieBannerCopy(
  content: CookieBannerCopyInput,
  language: string | undefined,
): CookieBannerCopy {
  const followsLanguage = Boolean(language) && cookieBannerFollowsPageLanguage(content);
  if (followsLanguage && language) {
    const L = getPresellUiStrings(language);
    return {
      title: L.cookieTitle,
      body: L.cookieBody,
      allowLabel: L.cookieAllow,
      declineLabel: L.cookieClose,
      policyLabel: L.cookiePolicy,
      followsLanguage: true,
    };
  }
  return {
    title: content.title?.trim() || "We Value Your Privacy",
    body:
      content.body?.trim() ||
      "We use cookies to enhance your browsing experience and analyze site traffic. By clicking Accept All, you consent to our use of cookies.",
    allowLabel: content.allowLabel?.trim() || "ACCEPT ALL",
    declineLabel: content.declineLabel?.trim() || "Manage Preferences",
    policyLabel: content.policyLabel?.trim() || "Cookie Policy",
    followsLanguage: false,
  };
}

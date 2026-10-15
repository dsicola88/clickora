import { PRESHELL_UI_STRINGS } from "@/lib/presellUiStrings.locales";
import { getPresellUiStrings } from "@/lib/presellUiStrings";

const STOCK_TITLES = new Set([
  ...Object.values(PRESHELL_UI_STRINGS).map((s) => s.cookieTitle.trim()),
  "We Value Your Privacy",
  "Cookie Policy",
  "Política de cookies",
]);

export type CookieBannerCopyInput = {
  title?: string;
  body?: string;
  allowLabel?: string;
  declineLabel?: string;
  policyLabel?: string;
  footerNote?: string;
  /** false = o texto gravado no widget manda. true ou ausente com título de stock = idioma da página. */
  followLanguage?: boolean;
};

export type CookieBannerCopy = {
  title: string;
  body: string;
  allowLabel: string;
  declineLabel: string;
  policyLabel: string;
  footerNote: string;
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
      footerNote: L.cookieFooter,
      followsLanguage: true,
    };
  }
  const fallback = getPresellUiStrings(language || "en");
  return {
    title: content.title?.trim() || fallback.cookieTitle,
    body: content.body?.trim() || fallback.cookieBody,
    allowLabel: content.allowLabel?.trim() || fallback.cookieAllow,
    declineLabel: content.declineLabel?.trim() || fallback.cookieClose,
    policyLabel: content.policyLabel?.trim() || fallback.cookiePolicy,
    footerNote: content.footerNote === undefined ? fallback.cookieFooter : content.footerNote,
    followsLanguage: false,
  };
}

export function clampCookieOverlayOpacity(raw: unknown, fallback = 28): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(70, Math.max(0, Math.round(n)));
}

export function clampCookieOverlayBlur(raw: unknown, fallback = 2): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(12, Math.max(0, Math.round(n)));
}

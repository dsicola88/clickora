import { PRESHELL_UI_STRINGS } from "@/lib/presellUiStrings.locales";
import { getPresellUiStrings } from "@/lib/presellUiStrings";

const STOCK_TITLES = new Set([
  ...Object.values(PRESHELL_UI_STRINGS).map((s) => s.cookieTitle.trim()),
  "We Value Your Privacy",
  "Cookie Policy",
  "Política de cookies",
  "A sua privacidade é importante",
  "Ihre Privatsphäre ist uns wichtig",
  "Nous respectons votre vie privée",
  "La tua privacy è importante",
  "Valoramos tu privacidad",
]);

const STOCK_POLICY_LABELS = [
  ...new Set(Object.values(PRESHELL_UI_STRINGS).map((s) => s.cookiePolicy.trim()).filter(Boolean)),
];

/** Rótulos antigos/errados que não podem ficar citados no corpo se o botão já mudou. */
const LEGACY_ALLOW_LABELS = [
  "Alle akzeptieren",
  "ACCEPT ALL",
  "Accept All",
  "Akzeptieren & fortfahren",
  "Accepter et continuer",
  "Accetta e continua",
  "Aceptar todo",
  "Tout accepter",
  "Accetta tutto",
  "Erlauben",
  "Allow",
  "Permitir",
  "Autoriser",
  "Consenti",
  "Zezwól",
  "İzin ver",
  "Toestaan",
  "Tillåt",
  "Tillat",
  "Tillad",
  "السماح",
  "अनुमति दें",
].sort((a, b) => b.length - a.length);

/** Definições falsas ou «rejeitar todos» sem CMP real — o 2.º botão só fecha/desbloqueia. */
const FAKE_SECONDARY_CLOSE =
  /einstellungen\s+verwalten|gérer\s+les\s+préférences|gestisci\s+preferenze|gestionar\s+preferencias|manage\s+preferences|manage\s+settings|alle\s+ablehnen|reject\s+all|refuse\s+all|tout\s+refuser|rifiuta\s+tutto|rechazar\s+todo|recusar\s+tudo|recusar\s+todos|alles\s+ablehnen|odrzuc\s+wszystko/i;

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function cookieBannerFollowsPageLanguage(content: CookieBannerCopyInput): boolean {
  if (content.followLanguage === false) return false;
  if (content.followLanguage === true) return true;
  const title = (content.title ?? "").trim();
  if (!title) return true;
  return STOCK_TITLES.has(title);
}

/** Garante que o corpo cita o mesmo rótulo do botão Aceitar (regra #1 de um bom modal). */
export function syncCookieBodyWithAllowLabel(body: string, allowLabel: string): string {
  const allow = allowLabel.trim();
  if (!body.trim() || !allow) return body;
  let out = body;
  for (const legacy of LEGACY_ALLOW_LABELS) {
    if (!legacy || legacy === allow) continue;
    const quoted = [
      [`„${legacy}“`, `„${allow}“`],
      [`«${legacy}»`, `«${allow}»`],
      [`« ${legacy} »`, `«${allow}»`],
      [`"${legacy}"`, `"${allow}"`],
      [`'${legacy}'`, `'${allow}'`],
      [`“${legacy}”`, `“${allow}”`],
    ] as const;
    for (const [from, to] of quoted) {
      if (out.includes(from)) out = out.split(from).join(to);
    }
    // Sem aspas (ex.: «By clicking Accept All,»)
    const bare = new RegExp(`(?<![\\w«»„“”"'])${escapeRegExp(legacy)}(?![\\w«»„“”"'])`, "g");
    out = out.replace(bare, allow);
  }
  return out;
}

/** Segundo botão não pode parecer definições/rejeição total se só fecha o modal. */
export function sanitizeCookieCloseLabel(label: string, fallback: string): string {
  const v = label.trim();
  if (!v) return fallback;
  if (FAKE_SECONDARY_CLOSE.test(v)) return fallback;
  return v;
}

/**
 * O UI acrescenta o link `policyLabel` depois do corpo.
 * Se o texto já termina com esse nome (páginas legadas), remove para não duplicar
 * («…Cookie-Richtlinie. Cookie-Richtlinie.»).
 */
export function stripTrailingCookiePolicyLabel(body: string, policyLabel: string): string {
  if (!body.trim()) return body;
  const labels = [
    policyLabel.trim(),
    ...STOCK_POLICY_LABELS,
  ].filter(Boolean);
  let out = body;
  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const next = out
      .replace(new RegExp(`(?:\\s*[«»„“”"']?${escaped}[«»„“”"']?\\s*\\.?)\\s*$`, "iu"), "")
      .trimEnd();
    if (next !== out) {
      out = next;
      break;
    }
  }
  return out;
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
      body: stripTrailingCookiePolicyLabel(L.cookieBody, L.cookiePolicy),
      allowLabel: L.cookieAllow,
      declineLabel: L.cookieClose,
      policyLabel: L.cookiePolicy,
      footerNote: L.cookieFooter,
      followsLanguage: true,
    };
  }
  const fallback = getPresellUiStrings(language || "en");
  const allowLabel = content.allowLabel?.trim() || fallback.cookieAllow;
  const declineLabel = sanitizeCookieCloseLabel(
    content.declineLabel?.trim() || fallback.cookieClose,
    fallback.cookieClose,
  );
  const policyLabel = content.policyLabel?.trim() || fallback.cookiePolicy;
  const rawBody = content.body?.trim() || fallback.cookieBody;
  return {
    title: content.title?.trim() || fallback.cookieTitle,
    body: stripTrailingCookiePolicyLabel(
      syncCookieBodyWithAllowLabel(rawBody, allowLabel),
      policyLabel,
    ),
    allowLabel,
    declineLabel,
    policyLabel,
    footerNote: content.footerNote === undefined ? fallback.cookieFooter : content.footerNote,
    followsLanguage: false,
  };
}

/** Véu suave (~12%): a página por baixo continua legível. */
export function clampCookieOverlayOpacity(raw: unknown, fallback = 12): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(70, Math.max(0, Math.round(n)));
}

/** Sem blur por defeito — blur tornava a review ilegível atrás do modal. */
export function clampCookieOverlayBlur(raw: unknown, fallback = 0): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(12, Math.max(0, Math.round(n)));
}

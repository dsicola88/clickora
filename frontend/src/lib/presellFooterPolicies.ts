import type { ImportedPolicyUrls } from "@/lib/presellGenerationNiche";

/** Políticas desta presell (domínio do afiliado / Clickora) — nunca confundir com o site do produtor. */
export const OPERATOR_POLICY_PATHS = {
  privacy: "/privacidade",
  terms: "/termos",
  medical: "/aviso-medico",
  /** Aviso de cookies das páginas de oferta (≠ /privacidade das contas SaaS). */
  cookies: "/aviso-cookies",
} as const;

export type PresellFooterPolicyBundle = {
  operator: {
    privacy: string;
    terms: string;
    cookies: string;
    medical: string;
  };
  merchant: {
    privacy?: string;
    terms?: string;
    refund?: string;
    shipping?: string;
  };
};

function trimUrl(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function isExternalHttpUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.startsWith("/") || t.startsWith("#")) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Defaults do operador — mesma origem da presell publicada. */
export function defaultOperatorPolicySettings(): Record<string, string> {
  return {
    privacyPolicyUrl: OPERATOR_POLICY_PATHS.privacy,
    cookiePolicyUrl: OPERATOR_POLICY_PATHS.cookies,
    termsUrl: OPERATOR_POLICY_PATHS.terms,
  };
}

/**
 * URLs do comerciante ficam em chaves separadas; privacidade/termos do rodapé principal
 * são sempre os do operador (evita parecer site oficial).
 */
export function applyImportedPolicyToSettings(
  settings: Record<string, unknown>,
  policies: ImportedPolicyUrls | undefined,
): Record<string, unknown> {
  /** URLs externas do formulário — cookies dedicadas ≠ privacidade do merchant. */
  const incomingCookie = trimUrl(settings.cookiePolicyUrl);
  const incomingPrivacy = trimUrl(settings.privacyPolicyUrl);
  const next: Record<string, unknown> = {
    ...settings,
    ...defaultOperatorPolicySettings(),
  };
  if (policies?.privacy?.trim()) next.merchantPrivacyUrl = policies.privacy.trim();
  if (policies?.terms?.trim()) next.merchantTermsUrl = policies.terms.trim();
  if (policies?.refund?.trim()) next.merchantRefundUrl = policies.refund.trim();
  if (policies?.shipping?.trim()) next.merchantShippingUrl = policies.shipping.trim();
  if (
    isExternalHttpUrl(incomingCookie) &&
    !isClickoraAccountPrivacyUrl(incomingCookie) &&
    !isClickoraOperatorPolicyUrl(incomingCookie)
  ) {
    next.cookiePolicyUrl = incomingCookie;
  }
  if (
    !trimUrl(next.merchantPrivacyUrl) &&
    isExternalHttpUrl(incomingPrivacy) &&
    !isClickoraAccountPrivacyUrl(incomingPrivacy)
  ) {
    next.merchantPrivacyUrl = incomingPrivacy;
  }

  return migrateLegacyOperatorUrls(next);
}

/** Presells antigas guardavam o link do vendedor em privacyPolicyUrl — reclassifica. */
export function migrateLegacyOperatorUrls(settings: Record<string, unknown>): Record<string, unknown> {
  const next = { ...settings };
  const privacyRaw = trimUrl(next.privacyPolicyUrl);
  if (isExternalHttpUrl(privacyRaw) && !isClickoraAccountPrivacyUrl(privacyRaw)) {
    if (!trimUrl(next.merchantPrivacyUrl)) next.merchantPrivacyUrl = privacyRaw;
  }
  const termsRaw = trimUrl(next.termsUrl);
  if (isExternalHttpUrl(termsRaw) && !isClickoraSaasLegalUrl(termsRaw)) {
    if (!trimUrl(next.merchantTermsUrl)) next.merchantTermsUrl = termsRaw;
  }
  const cookieRaw = trimUrl(next.cookiePolicyUrl);
  const keepExternalCookie =
    isExternalHttpUrl(cookieRaw) &&
    !isClickoraAccountPrivacyUrl(cookieRaw) &&
    cookieRaw !== OPERATOR_POLICY_PATHS.cookies;

  next.privacyPolicyUrl = OPERATOR_POLICY_PATHS.privacy;
  next.cookiePolicyUrl = keepExternalCookie ? cookieRaw : OPERATOR_POLICY_PATHS.cookies;
  if (isExternalHttpUrl(trimUrl(next.termsUrl))) {
    next.termsUrl = OPERATOR_POLICY_PATHS.terms;
  }
  if (!trimUrl(next.termsUrl)) next.termsUrl = OPERATOR_POLICY_PATHS.terms;
  return next;
}

export function resolvePresellFooterPolicies(
  settings: Record<string, unknown> | undefined,
  contentPolicyUrls?: ImportedPolicyUrls | null,
): PresellFooterPolicyBundle {
  const s = migrateLegacyOperatorUrls(settings ?? {});
  const fromContent = contentPolicyUrls ?? {};

  const merchant = {
    privacy: sanitizeMerchantUrl(trimUrl(s.merchantPrivacyUrl) || trimUrl(fromContent.privacy)),
    terms: sanitizeMerchantUrl(trimUrl(s.merchantTermsUrl) || trimUrl(fromContent.terms)),
    refund: sanitizeMerchantUrl(trimUrl(s.merchantRefundUrl) || trimUrl(fromContent.refund)),
    shipping: sanitizeMerchantUrl(trimUrl(s.merchantShippingUrl) || trimUrl(fromContent.shipping)),
  };

  return {
    operator: {
      privacy: trimUrl(s.privacyPolicyUrl) || OPERATOR_POLICY_PATHS.privacy,
      terms: trimUrl(s.termsUrl) || OPERATOR_POLICY_PATHS.terms,
      cookies:
        trimUrl(s.cookiePolicyUrl) ||
        OPERATOR_POLICY_PATHS.cookies,
      medical: OPERATOR_POLICY_PATHS.medical,
    },
    merchant,
  };
}

/** Remove hosts SaaS (dclickora/clickora) de um mapa policy_urls importado. */
export function sanitizeImportedPolicyUrls(raw: unknown): ImportedPolicyUrls | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const pick = (k: string) => sanitizeMerchantUrl(typeof row[k] === "string" ? row[k].trim() : undefined);
  const urls: ImportedPolicyUrls = {
    ...(pick("privacy") ? { privacy: pick("privacy") } : {}),
    ...(pick("terms") ? { terms: pick("terms") } : {}),
    ...(pick("refund") ? { refund: pick("refund") } : {}),
    ...(pick("shipping") ? { shipping: pick("shipping") } : {}),
  };
  return Object.keys(urls).length ? urls : null;
}

export function policyUrlsFromPresellContent(content: Record<string, unknown>): ImportedPolicyUrls | null {
  return sanitizeImportedPolicyUrls(content.policyUrls ?? content.policy_urls);
}

/** Paths/URLs da Clickora — nunca usar no modal de cookies da oferta. */
export function isClickoraOperatorPolicyUrl(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) return false;
  /** Paths relativos da app (mesma origem da presell publicada). */
  if (
    t === OPERATOR_POLICY_PATHS.privacy ||
    t === OPERATOR_POLICY_PATHS.terms ||
    t === OPERATOR_POLICY_PATHS.medical ||
    t === "/privacy" ||
    t === "/privacy-policy" ||
    t === "/cookie-policy" ||
    t === "/cookies"
  ) {
    return true;
  }
  try {
    const u = new URL(t);
    const path = u.pathname.replace(/\/$/, "") || "/";
    /** Só paths legais PT da plataforma — /privacy genérico do produtor é válido. */
    return path === "/privacidade" || path === "/termos" || path === "/aviso-medico";
  } catch {
    return false;
  }
}

/**
 * Link «Cookie-Richtlinie» / política de cookies do modal:
 * 1) URL de cookies dedicada (externa do afiliado/produtor), se válida
 * 2) `/aviso-cookies` gerado pela plataforma (explica trackers da presell)
 * Nunca usa automaticamente a privacidade do merchant nem `/privacidade` (contas SaaS).
 * A política do produtor continua no rodapé (merchantPrivacy).
 */
export function resolveVisitorCookiePolicyUrl(
  settings?: Record<string, unknown>,
  contentPolicyUrls?: ImportedPolicyUrls | null,
  language?: string,
): string {
  void contentPolicyUrls; // merchant privacy ≠ cookie notice
  const rawCookie = trimUrl(settings?.cookiePolicyUrl);
  if (rawCookie) {
    if (rawCookie === OPERATOR_POLICY_PATHS.cookies || rawCookie.startsWith(`${OPERATOR_POLICY_PATHS.cookies}?`)) {
      return withCookieLang(rawCookie, language);
    }
    if (isExternalHttpUrl(rawCookie) && !isClickoraAccountPrivacyUrl(rawCookie)) {
      return rawCookie;
    }
    if (rawCookie === OPERATOR_POLICY_PATHS.privacy || isClickoraAccountPrivacyUrl(rawCookie)) {
      return withCookieLang(OPERATOR_POLICY_PATHS.cookies, language);
    }
  }
  return withCookieLang(OPERATOR_POLICY_PATHS.cookies, language);
}

function withCookieLang(pathOrUrl: string, language?: string): string {
  if (!language || !pathOrUrl.startsWith("/aviso-cookies")) return pathOrUrl;
  const loc = language.trim();
  if (!loc) return pathOrUrl;
  const sep = pathOrUrl.includes("?") ? "&" : "?";
  if (/[?&]lang=/.test(pathOrUrl)) return pathOrUrl;
  return `${pathOrUrl}${sep}lang=${encodeURIComponent(loc)}`;
}

/** Hosts do SaaS — nunca no rodapé «merchant» de uma white/presell de afiliado. */
export function isClickoraSaasMarketingHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  return h === "dclickora.com" || h === "clickora.com";
}

/** /privacidade e equivalentes de conta — não servem como Cookie-Richtlinie da oferta. */
function isClickoraAccountPrivacyUrl(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (t === OPERATOR_POLICY_PATHS.privacy || t === "/privacy" || t === "/privacy-policy") return true;
  try {
    const u = new URL(t);
    if (isClickoraSaasMarketingHost(u.hostname)) return true;
    const path = u.pathname.replace(/\/$/, "") || "/";
    return path === "/privacidade";
  } catch {
    return false;
  }
}

/** URLs do site SaaS (privacy/terms da app) — não são política do produtor. */
export function isClickoraSaasLegalUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (isClickoraOperatorPolicyUrl(t) && !isExternalHttpUrl(t)) return true;
  try {
    const u = new URL(t);
    if (!isClickoraSaasMarketingHost(u.hostname)) return false;
    const path = u.pathname.replace(/\/$/, "") || "/";
    return (
      path === "/privacy" ||
      path === "/privacy-policy" ||
      path === "/terms" ||
      path === "/terms-of-service" ||
      path === "/contact" ||
      path === "/contato" ||
      path === "/privacidade" ||
      path === "/termos" ||
      path === "/aviso-cookies" ||
      path === "/aviso-medico"
    );
  } catch {
    return false;
  }
}

function sanitizeMerchantUrl(raw: string | undefined): string | undefined {
  const t = trimUrl(raw);
  if (!t) return undefined;
  if (isClickoraSaasLegalUrl(t) || isClickoraAccountPrivacyUrl(t)) return undefined;
  return t;
}

export function merchantPolicyLinks(bundle: PresellFooterPolicyBundle): { id: string; href: string }[] {
  const m = bundle.merchant;
  const out: { id: string; href: string }[] = [];
  const privacy = sanitizeMerchantUrl(m.privacy);
  const terms = sanitizeMerchantUrl(m.terms);
  const refund = sanitizeMerchantUrl(m.refund);
  const shipping = sanitizeMerchantUrl(m.shipping);
  if (privacy) out.push({ id: "merchantPrivacy", href: privacy });
  if (terms) out.push({ id: "merchantTerms", href: terms });
  if (refund) out.push({ id: "merchantRefund", href: refund });
  if (shipping) out.push({ id: "merchantShipping", href: shipping });
  return out;
}

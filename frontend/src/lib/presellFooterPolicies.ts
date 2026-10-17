import type { ImportedPolicyUrls } from "@/lib/presellGenerationNiche";

/** Políticas desta presell (domínio do afiliado / Clickora) — nunca confundir com o site do produtor. */
export const OPERATOR_POLICY_PATHS = {
  privacy: "/privacidade",
  terms: "/termos",
  medical: "/aviso-medico",
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
    cookiePolicyUrl: OPERATOR_POLICY_PATHS.privacy,
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
  const next: Record<string, unknown> = {
    ...settings,
    ...defaultOperatorPolicySettings(),
  };
  if (!policies) return migrateLegacyOperatorUrls(next);

  if (policies.privacy?.trim()) next.merchantPrivacyUrl = policies.privacy.trim();
  if (policies.terms?.trim()) next.merchantTermsUrl = policies.terms.trim();
  if (policies.refund?.trim()) next.merchantRefundUrl = policies.refund.trim();
  if (policies.shipping?.trim()) next.merchantShippingUrl = policies.shipping.trim();

  return migrateLegacyOperatorUrls(next);
}

/** Presells antigas guardavam o link do vendedor em privacyPolicyUrl — reclassifica. */
export function migrateLegacyOperatorUrls(settings: Record<string, unknown>): Record<string, unknown> {
  const next = { ...settings };
  for (const key of ["privacyPolicyUrl", "cookiePolicyUrl", "termsUrl"] as const) {
    const raw = trimUrl(next[key]);
    if (!isExternalHttpUrl(raw)) continue;
    const merchantKey =
      key === "termsUrl"
        ? "merchantTermsUrl"
        : key === "cookiePolicyUrl"
          ? "merchantPrivacyUrl"
          : "merchantPrivacyUrl";
    if (!trimUrl(next[merchantKey])) next[merchantKey] = raw;
  }
  next.privacyPolicyUrl = OPERATOR_POLICY_PATHS.privacy;
  next.cookiePolicyUrl = OPERATOR_POLICY_PATHS.privacy;
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
    privacy: trimUrl(s.merchantPrivacyUrl) || trimUrl(fromContent.privacy) || undefined,
    terms: trimUrl(s.merchantTermsUrl) || trimUrl(fromContent.terms) || undefined,
    refund: trimUrl(s.merchantRefundUrl) || trimUrl(fromContent.refund) || undefined,
    shipping: trimUrl(s.merchantShippingUrl) || trimUrl(fromContent.shipping) || undefined,
  };

  return {
    operator: {
      privacy: trimUrl(s.privacyPolicyUrl) || OPERATOR_POLICY_PATHS.privacy,
      terms: trimUrl(s.termsUrl) || OPERATOR_POLICY_PATHS.terms,
      cookies: trimUrl(s.cookiePolicyUrl) || trimUrl(s.privacyPolicyUrl) || OPERATOR_POLICY_PATHS.privacy,
      medical: OPERATOR_POLICY_PATHS.medical,
    },
    merchant,
  };
}

export function policyUrlsFromPresellContent(content: Record<string, unknown>): ImportedPolicyUrls | null {
  const raw = content.policyUrls ?? content.policy_urls;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const pick = (k: string) => (typeof row[k] === "string" ? row[k].trim() : undefined);
  const urls: ImportedPolicyUrls = {
    ...(pick("privacy") ? { privacy: pick("privacy") } : {}),
    ...(pick("terms") ? { terms: pick("terms") } : {}),
    ...(pick("refund") ? { refund: pick("refund") } : {}),
    ...(pick("shipping") ? { shipping: pick("shipping") } : {}),
  };
  return Object.keys(urls).length ? urls : null;
}

export function merchantPolicyLinks(bundle: PresellFooterPolicyBundle): { id: string; href: string }[] {
  const m = bundle.merchant;
  const out: { id: string; href: string }[] = [];
  if (m.privacy) out.push({ id: "merchantPrivacy", href: m.privacy });
  if (m.terms) out.push({ id: "merchantTerms", href: m.terms });
  if (m.refund) out.push({ id: "merchantRefund", href: m.refund });
  if (m.shipping) out.push({ id: "merchantShipping", href: m.shipping });
  return out;
}

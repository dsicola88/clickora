import type { OfferValidationStatus } from "@prisma/client";
import { assertExternalProductUrl } from "./presellImportSsrf";
import { hasUntrustedOpenRedirectQuery, isOptOutOrUnsubscribeAnchor } from "./mirrorExternalHosts";
import { affiliateLinkFromPresellPage, isRedirectToAllowedOffer } from "./trackOfferRedirectGuard";
import { canonicalPlatformId } from "./affiliatePlatforms/parseAffiliatePostback";
import { platformIdFromOfferHost } from "./affiliatePlatforms/outboundClickParams";

export type OfferValidationIssue = {
  code:
    | "OFFER_EMPTY_URL"
    | "OFFER_INVALID_URL"
    | "OFFER_SSRF_OR_INVALID_HOST"
    | "OFFER_OPTOUT_URL"
    | "OFFER_OPEN_REDIRECT";
  field: "hoplinkUrl" | "backupHoplinkUrl";
  message: string;
};

export type OfferSafetyCheckResult = {
  ok: boolean;
  status: OfferValidationStatus;
  issues: OfferValidationIssue[];
  detectedNetwork: string | null;
};

function validateSingleOfferUrl(
  rawUrl: string,
  field: "hoplinkUrl" | "backupHoplinkUrl",
): { ok: true; url: URL } | { ok: false; issue: OfferValidationIssue } {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === "#") {
    return {
      ok: false,
      issue: {
        code: "OFFER_EMPTY_URL",
        field,
        message: "Informe um URL de oferta válido começando com https:// ou http://.",
      },
    };
  }

  let parsed: URL;
  try {
    parsed = assertExternalProductUrl(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "URL de oferta inválido ou não permitido.";
    const isInvalidSyntax = msg === "URL inválido.";
    return {
      ok: false,
      issue: {
        code: isInvalidSyntax ? "OFFER_INVALID_URL" : "OFFER_SSRF_OR_INVALID_HOST",
        field,
        message: msg,
      },
    };
  }

  if (isOptOutOrUnsubscribeAnchor({ href: parsed.href })) {
    return {
      ok: false,
      issue: {
        code: "OFFER_OPTOUT_URL",
        field,
        message: "URL de opt-out / unsubscribe de mailer não pode ser usado como destino de oferta.",
      },
    };
  }

  if (hasUntrustedOpenRedirectQuery(parsed, new Set())) {
    return {
      ok: false,
      issue: {
        code: "OFFER_OPEN_REDIRECT",
        field,
        message: "URL contém parâmetro de open-redirect suspeito para destino não autorizado.",
      },
    };
  }

  return { ok: true, url: parsed };
}

export function detectOfferNetwork(hoplinkUrl: string, declaredNetwork?: string | null): string | null {
  const canonical = canonicalPlatformId(declaredNetwork);
  if (canonical) return canonical;
  try {
    const parsed = new URL(hoplinkUrl.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const fromHost = platformIdFromOfferHost(host);
    if (fromHost) return fromHost;
    // Domínios MaxWeb personalizados (ex.: mwzenith.com/12271/11202/7/)
    if (/^mw[a-z0-9-]+\./.test(host) && /^\/\d+\/\d+\/\d+\/?$/.test(parsed.pathname)) {
      return "maxweb";
    }
  } catch {
    // ignore
  }
  const raw = declaredNetwork?.trim();
  return raw ? raw : null;
}

/**
 * Validação estática determinística (sem rede) de segurança e conformidade de uma oferta.
 * Bloqueia SSRF, esquemas perigosos, credenciais na URL, opt-out links e open-redirects suspeitos.
 */
export function validateOfferSafety(input: {
  hoplinkUrl: string;
  backupHoplinkUrl?: string | null;
  network?: string | null;
}): OfferSafetyCheckResult {
  const issues: OfferValidationIssue[] = [];
  const primary = validateSingleOfferUrl(input.hoplinkUrl ?? "", "hoplinkUrl");
  if (!primary.ok) issues.push(primary.issue);

  if (input.backupHoplinkUrl && input.backupHoplinkUrl.trim()) {
    const backup = validateSingleOfferUrl(input.backupHoplinkUrl, "backupHoplinkUrl");
    if (!backup.ok) issues.push(backup.issue);
  }

  const detectedNetwork = primary.ok
    ? detectOfferNetwork(primary.url.href, input.network)
    : canonicalPlatformId(input.network) ?? (input.network?.trim() || null);

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? "valid" : "blocked",
    issues,
    detectedNetwork,
  };
}

export type LinkedOfferSnapshot = {
  id: string;
  hoplinkUrl: string;
  backupHoplinkUrl?: string | null;
  network?: string | null;
  validationStatus: OfferValidationStatus | string;
  isActive: boolean;
};

export type EffectiveOfferResolution =
  | {
      ok: true;
      destination: string;
      backupDestination: string | null;
      /** Outros destinos aceites no parâmetro `to` do hop (ex.: hoplink da Offer quando a presell guarda o link legado). */
      alternateDestinations: string[];
      network: string | null;
      offerId: string | null;
      source: "offer_entity" | "legacy_presell";
    }
  | {
      ok: false;
      reason: "offer_blocked" | "offer_inactive" | "offer_invalid_url" | "missing_offer";
      offerId: string | null;
    };

function isHttpUrl(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    new URL(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve o destino efetivo para uma presell no hop `/track/r/` e cache edge.
 * - Com `offer` ligada: exige oferta ativa e não bloqueada. O destino é o link gravado na presell
 *   (mantido em sincronia pela Offer) e, na falta dele, o hoplink da Offer.
 * - Sem `offer`: compatibilidade total com campos legados (`content.affiliateLink` / `tracking.offerUrl`).
 * A validação heurística estrita (open-redirect, opt-out) corre ao gravar/validar a oferta, não no hop,
 * para nunca cortar cliques pagos de hoplinks já publicados.
 */
export function resolveEffectiveOfferForPresell(input: {
  offer?: LinkedOfferSnapshot | null;
  content: unknown;
  tracking: unknown;
}): EffectiveOfferResolution {
  const legacy = affiliateLinkFromPresellPage(input.content, input.tracking);
  const legacyUrl = isHttpUrl(legacy) ? legacy.trim() : null;

  if (input.offer) {
    if (!input.offer.isActive) {
      return { ok: false, reason: "offer_inactive", offerId: input.offer.id };
    }
    const backup =
      input.offer.backupHoplinkUrl &&
      validateOfferSafety({ hoplinkUrl: input.offer.backupHoplinkUrl }).ok
        ? input.offer.backupHoplinkUrl.trim()
        : null;
    if (input.offer.validationStatus === "blocked") {
      if (!backup) return { ok: false, reason: "offer_blocked", offerId: input.offer.id };
      return {
        ok: true,
        destination: backup,
        backupDestination: null,
        alternateDestinations: [],
        network: input.offer.network?.trim() || null,
        offerId: input.offer.id,
        source: "offer_entity",
      };
    }
    const offerUrl = isHttpUrl(input.offer.hoplinkUrl) ? input.offer.hoplinkUrl.trim() : null;
    const destination = legacyUrl ?? offerUrl;
    if (!destination) {
      return { ok: false, reason: "offer_invalid_url", offerId: input.offer.id };
    }
    return {
      ok: true,
      destination,
      backupDestination: backup,
      alternateDestinations: offerUrl && offerUrl !== destination ? [offerUrl] : [],
      network: input.offer.network?.trim() || null,
      offerId: input.offer.id,
      source: "offer_entity",
    };
  }

  if (!legacy) {
    return { ok: false, reason: "missing_offer", offerId: null };
  }
  if (!legacyUrl) {
    return { ok: false, reason: "offer_invalid_url", offerId: null };
  }
  return {
    ok: true,
    destination: legacyUrl,
    backupDestination: null,
    alternateDestinations: [],
    network: null,
    offerId: null,
    source: "legacy_presell",
  };
}

export function isRedirectAllowedForEffectiveOffer(
  requestedTo: string,
  primaryDestination: string,
  backupDestination?: string | null,
  alternateDestinations?: readonly string[] | null,
): boolean {
  if (isRedirectToAllowedOffer(requestedTo, primaryDestination)) return true;
  if (backupDestination && isRedirectToAllowedOffer(requestedTo, backupDestination)) return true;
  for (const alt of alternateDestinations ?? []) {
    if (alt && isRedirectToAllowedOffer(requestedTo, alt)) return true;
  }
  return false;
}

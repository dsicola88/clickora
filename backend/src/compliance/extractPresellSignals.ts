import { createHash } from "node:crypto";
import type { PresellComplianceSignals } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.length;
}

function uniqueSentences(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 20);
  return new Set(sentences).size;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const AFFILIATE_DISCLOSURE =
  /\b(afiliad[oa]|affiliate|comissão|comissao|link\s+de\s+afiliad|may\s+earn|podemos\s+receber|relação\s+comercial|relacao\s+comercial|parceiro\s+comercial)\b/i;

const BUSINESS_IDENTITY =
  /\b(empresa|razão\s+social|razao\s+social|NIF|CNPJ|VAT|LLC|Ltd\.?|Inc\.?|operado\s+por|operated\s+by|responsável|responsavel|contact(?:o|e)?\s*:|email\s*:)\b/i;

const HEALTH_CURE =
  /\b(cura\s+(garantida|total|completa)|cure[sd]?\s+(guaranteed|completely)|trata(?:mento)?\s+(garantid[oa]|definitiv[oa])|elimina\s+(a\s+)?doença|elimina\s+(a\s+)?doenca|prevents?\s+cancer|cura\s+o?\s*cancro|miracle\s+cure|cura\s+milagrosa)\b/i;

const GUARANTEED_RESULT =
  /\b(resultado[s]?\s+garantid[oa]s?|guaranteed\s+results?|100%\s+(eficaz|effective|garantid)|ganhos?\s+garantid|renda\s+garantida|emagrece\s+\d+\s*kg\s+em\s+\d+|lose\s+\d+\s*lbs?\s+in\s+\d+|imediat(o|amente)\s+e\s+garantid)\b/i;

const UNSOURCED_STUDY =
  /\b((estudos?|studies|pesquisa|research)\s+(comprovam|provam|show|prove)|depoimento[s]?\s+reais|real\s+testimonial)(?![^.]*https?:)/i;

const INVENTED_PRICE =
  /\b(de\s+R\$\s*\d+[.,]?\d*\s+por\s+R\$\s*\d+|was\s+\$\d+\s+now\s+\$\d+|só\s+hoje\s+R\$|only\s+today\s+\$)\b/i;

const MALICIOUS_SCRIPT =
  /<script[\s\S]*?(document\.cookie|eval\s*\(|atob\s*\(|fromCharCode|crypto\.miner|coinhive|window\.location\s*=\s*['"]https?:)/i;

export type ExtractPresellInput = {
  title: string;
  type?: string | null;
  language?: string | null;
  category?: string | null;
  content?: unknown;
  settings?: unknown;
  videoUrl?: string | null;
  pageHostHint?: string | null;
};

export function extractPresellSignals(input: ExtractPresellInput): PresellComplianceSignals {
  const content = asRecord(input.content);
  const settings = asRecord(input.settings);

  const productName =
    asString(content.product_name || content.productName || content.title || input.title).trim() ||
    input.title.trim();
  const salesText = asString(content.sales_text || content.salesText || content.body || "").trim();
  const subtitle = asString(content.subtitle || "").trim();
  const ctaText = asString(content.cta_text || content.ctaText || "").trim();
  const affiliateLink = asString(content.affiliate_link || content.affiliateLink || "").trim() || null;
  const sourceUrl = asString(content.source_url || content.sourceUrl || "").trim() || null;
  const mirrorHtml = asString(
    content.import_mirror_src_doc || content.importMirrorSrcDoc || content.mirrorHtml || "",
  );
  const images = Array.isArray(content.images)
    ? content.images
    : Array.isArray(content.productImages)
      ? content.productImages
      : [];
  const imageCount = images.filter((x) => typeof x === "string" && x.trim()).length;

  const disclosureText = [
    asString(content.affiliate_disclosure || content.affiliateDisclosure),
    asString(settings.affiliateDisclosure),
    asString(content.legal_footer || content.legalFooter),
    salesText,
    subtitle,
    mirrorHtml ? stripHtml(mirrorHtml).slice(0, 4000) : "",
  ].join("\n");

  const privacyPolicyUrl =
    asString(settings.privacyPolicyUrl || content.privacy_policy_url || content.privacyPolicyUrl).trim() ||
    null;
  const cookiePolicyUrl =
    asString(settings.cookiePolicyUrl || content.cookie_policy_url || content.cookiePolicyUrl).trim() ||
    null;
  const businessName =
    asString(settings.businessName || content.business_name || content.businessName).trim() || null;
  const contactEmail =
    asString(settings.contactEmail || content.contact_email || content.contactEmail).trim() || null;

  const claimsText = [salesText, subtitle, productName, ctaText, asString(content.social_proof)].join("\n");
  const bodyFromMirror = mirrorHtml ? stripHtml(mirrorHtml) : "";
  const combinedBody = [salesText, subtitle, bodyFromMirror].filter(Boolean).join("\n").trim();
  const wordCount = countWords(combinedBody);
  const uniqueSentenceCount = uniqueSentences(combinedBody);

  const priceVerified =
    content.rating_from_source === true || content.price_from_source === true
      ? true
      : content.price_from_source === false
        ? false
        : null;
  const priceMention = asString(content.price || content.product_price || "").trim() || null;

  const fingerprintPayload = JSON.stringify({
    title: input.title,
    type: input.type || "",
    productName,
    salesText,
    subtitle,
    ctaText,
    affiliateLink,
    sourceUrl,
    videoUrl: asString(input.videoUrl || "").trim(),
    mirrorLen: mirrorHtml.length,
    imageCount,
    settingsKeys: Object.keys(settings).sort(),
    businessName,
    privacyPolicyUrl,
    cookiePolicyUrl,
    affiliateDisclosure: asString(settings.affiliateDisclosure).trim(),
  });

  return {
    title: input.title.trim(),
    type: asString(input.type || "cookies") || "cookies",
    language: asString(input.language || "pt") || "pt",
    category: input.category ? asString(input.category) : null,
    productName,
    salesText,
    subtitle,
    ctaText,
    imageCount,
    hasExternalCta: Boolean(affiliateLink || ctaText),
    affiliateLink,
    sourceUrl,
    mirrorHtmlLength: mirrorHtml.length,
    mirrorHtml,
    bodyTextLength: combinedBody.length,
    wordCount,
    uniqueSentenceCount,
    hasAffiliateDisclosure: AFFILIATE_DISCLOSURE.test(disclosureText),
    hasBusinessIdentity: Boolean(businessName || contactEmail) || BUSINESS_IDENTITY.test(disclosureText),
    businessName,
    contactEmail,
    privacyPolicyUrl,
    cookiePolicyUrl,
    claimsText,
    healthCureClaim: HEALTH_CURE.test(claimsText),
    guaranteedResultClaim: GUARANTEED_RESULT.test(claimsText),
    unsourcedTestimonialOrStudy: UNSOURCED_STUDY.test(claimsText),
    inventedPriceSignal: INVENTED_PRICE.test(claimsText) && priceVerified === false,
    priceMention,
    priceVerifiedFromSource: priceVerified,
    maliciousScriptInImport: MALICIOUS_SCRIPT.test(mirrorHtml),
    cloakingEnabled: Boolean(settings.enterpriseCloak),
    exitPopup: Boolean(settings.exitPopup),
    offerHost: hostOf(affiliateLink),
    pageHostHint: input.pageHostHint ? asString(input.pageHostHint).toLowerCase() : null,
    contentFingerprint: createHash("sha256").update(fingerprintPayload).digest("hex").slice(0, 32),
  };
}

/** Heurística: só imagem + nome + botão externo, sem corpo substantivo. */
export function isThinBridgePage(signals: PresellComplianceSignals): boolean {
  const substantialWords = signals.wordCount >= 120 && signals.uniqueSentenceCount >= 3;
  const hasMirrorSubstance = signals.mirrorHtmlLength >= 2500 && signals.wordCount >= 80;
  if (substantialWords || hasMirrorSubstance) return false;
  const hasVisual = signals.imageCount >= 1 || signals.productName.length >= 2;
  const hasCta = signals.hasExternalCta;
  const thinCopy = signals.wordCount < 80 || signals.bodyTextLength < 280;
  return hasVisual && hasCta && thinCopy;
}

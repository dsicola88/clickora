import { merchantFooterCopy, merchantLinkLabel } from "@/lib/presellMerchantFooterCopy";
import {
  merchantPolicyLinks,
  policyUrlsFromPresellContent,
  resolvePresellFooterPolicies,
} from "@/lib/presellFooterPolicies";
import { getPresellUiStrings, normalizePresellLocale } from "@/lib/presellUiStrings";
import { getPortalChromeCopy } from "@/lib/presellPortalCopy";
import { mirrorReferenceNoticeText, publicAffiliateDisclosureText } from "@/lib/presellPublicComplianceCopy";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAffiliateDisclosureBannerExportHtml(language: string | undefined): string {
  const text = publicAffiliateDisclosureText(language);
  return `<div class="pe-affiliate-bar" role="note">${escapeHtml(text)}</div>`;
}

export function buildTrustFooterExportHtml(
  language: string | undefined,
  settings: Record<string, unknown>,
  content: Record<string, unknown>,
): string {
  const bundle = resolvePresellFooterPolicies(settings, policyUrlsFromPresellContent(content));
  const locale = normalizePresellLocale(language);
  const L = getPresellUiStrings(language);
  const copy = merchantFooterCopy(locale);
  const portal = getPortalChromeCopy(language);
  const { operator } = bundle;

  const operatorLinks = [
    { href: operator.privacy, label: copy.operatorPrivacy },
    { href: operator.terms, label: copy.operatorTerms },
    { href: operator.cookies, label: L.cookiePolicy },
    { href: operator.medical, label: portal.medical },
  ]
    .map(
      (l) =>
        `<a href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`,
    )
    .join("");

  const merchant = merchantPolicyLinks(bundle);
  const merchantBlock =
    merchant.length > 0
      ? `<div class="pe-trust-merchant"><p class="pe-trust-merchant-title">${escapeHtml(copy.section)}</p><nav class="pe-trust-merchant-nav">${merchant
          .map(({ id, href }) => {
            const label = merchantLinkLabel(
              locale,
              id as "merchantPrivacy" | "merchantTerms" | "merchantRefund" | "merchantShipping",
            );
            return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
          })
          .join("")}</nav></div>`
      : "";

  return `<section class="pe-trust-footer" aria-label="${escapeHtml(L.trustNavLabel)}">
<div class="pe-trust-footer-box">
<p class="pe-trust-kicker">${escapeHtml(L.trustNavLabel)}</p>
<p class="pe-trust-text">${escapeHtml(L.trustDisclosure)}</p>
<p class="pe-trust-text">${escapeHtml(L.trustAbout)}</p>
<nav class="pe-trust-nav">${operatorLinks}</nav>
${merchantBlock}
</div>
</section>`;
}

/** CSS partilhado pela exportação standalone e pelo inject do editor manual. */
export const EXPORT_COMPLIANCE_STYLES = `
.pe-affiliate-bar{position:sticky;top:0;z-index:40;padding:.65rem .85rem;text-align:center;font-size:.72rem;line-height:1.45;color:#78350f;background:#fffbeb;border-bottom:1px solid #fcd34d;}
.pe-trust-footer{max-width:48rem;margin:0 auto;padding:1rem .75rem 2.5rem;}
.pe-trust-footer-box{border-radius:1rem;border:1px solid rgba(0,0,0,.1);background:#f8fafc;padding:1.25rem 1rem;text-align:left;}
.pe-trust-kicker{font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 .65rem;}
.pe-trust-text{font-size:.78rem;line-height:1.55;color:#475569;margin:0 0 .5rem;}
.pe-trust-nav{display:flex;flex-wrap:wrap;gap:.65rem 1rem;font-size:.78rem;font-weight:600;margin:.75rem 0 0;}
.pe-trust-nav a{color:#0f172a;text-decoration:underline;text-underline-offset:2px;}
.pe-trust-merchant{margin-top:1rem;padding-top:.85rem;border-top:1px dashed #cbd5e1;}
.pe-trust-merchant-title{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin:0 0 .5rem;}
.pe-trust-merchant-nav{display:flex;flex-wrap:wrap;gap:.5rem .85rem;font-size:.75rem;font-weight:600;}
.pe-trust-merchant-nav a{color:#334155;text-decoration:underline;text-underline-offset:2px;}
.pe-mirror-note{max-width:64rem;margin:0 auto;padding:.65rem 1rem;font-size:.72rem;line-height:1.45;color:#475569;background:#f1f5f9;border-bottom:1px solid #e2e8f0;text-align:center;}
`;

export function buildMirrorReferenceNoticeExportHtml(language: string | undefined): string {
  return `<p class="pe-mirror-note" role="note">${escapeHtml(mirrorReferenceNoticeText(language))}</p>`;
}

/**
 * Fontes oficiais versionadas. Atualizar em conjunto com docs/compliance/POLICY_SOURCE_REGISTER.md.
 * Não tratar como verdade imutável — `META-001` assinala pacotes desatualizados.
 */

export const RULES_VERSION = "ads-compliance-2026.10.15";

/** Após este número de dias sem revalidação, META-001 emite WARNING. */
export const POLICY_STALE_AFTER_DAYS = 90;

export type PolicySourceStatus = "current" | "stale" | "unreachable" | "pending_review";

export type PolicySource = {
  id: string;
  platform: "google" | "microsoft" | "both";
  title: string;
  url: string;
  lastVerifiedAt: string; // ISO date YYYY-MM-DD
  status: PolicySourceStatus;
  scope: string;
};

export const POLICY_SOURCES: readonly PolicySource[] = [
  {
    id: "gads-destination-requirements",
    platform: "google",
    title: "Destination requirements",
    url: "https://support.google.com/adspolicy/answer/6368661",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Destination working, crawlable, experience, original content, URL",
  },
  {
    id: "gads-insufficient-original-content",
    platform: "google",
    title: "Insufficient original content",
    url: "https://support.google.com/adspolicy/answer/16427718",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Bridge pages, mirroring, scraping, empty/parked",
  },
  {
    id: "gads-misrepresentation",
    platform: "google",
    title: "Misrepresentation",
    url: "https://support.google.com/adspolicy/answer/6020955",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Identity, pricing, unreliable claims, unavailable offers",
  },
  {
    id: "gads-policies-overview",
    platform: "google",
    title: "Google Ads policies",
    url: "https://support.google.com/adspolicy/answer/6008942",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Prohibited/restricted content and practices including cloaking",
  },
  {
    id: "msads-apex-60280",
    platform: "microsoft",
    title: "Microsoft Advertising help Apex 60280",
    url: "https://help.ads.microsoft.com/apex/index/3/en/60280",
    lastVerifiedAt: "2026-10-15",
    status: "unreachable",
    scope: "Requested policy index — unavailable at consultation",
  },
  {
    id: "msads-relevance-quality",
    platform: "microsoft",
    title: "Relevance and quality policies (hub)",
    url: "https://about.ads.microsoft.com/en/resources/policies/relevance-and-quality-policies",
    lastVerifiedAt: "2026-10-15",
    status: "unreachable",
    scope: "EN normative hub — empty/unreachable at consultation",
  },
  {
    id: "msads-agreement",
    platform: "microsoft",
    title: "Microsoft Advertising Agreement",
    url: "https://help.ads.microsoft.com/resources/microsoft_advertising_agreement/en.pdf",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Privacy policy on destination, UET disclosure, consent",
  },
  {
    id: "msads-pilot-policy-cn",
    platform: "microsoft",
    title: "Microsoft Advertising pilot policy (CN PDF)",
    url: "https://help.ads.microsoft.com/resources/microsoft_advertising_policy/microsoft-advertising-pilot-policy-cn.pdf",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Landing page quality/UX (CN document; limited EN parity)",
  },
  {
    id: "msads-report-concern",
    platform: "microsoft",
    title: "Report a Concern",
    url: "https://about.ads.microsoft.com/en/forms/policies/report-spam-form",
    lastVerifiedAt: "2026-10-15",
    status: "current",
    scope: "Low quality / malvertising / relevance concerns",
  },
] as const;

export function getPolicySource(id: string): PolicySource | undefined {
  return POLICY_SOURCES.find((s) => s.id === id);
}

export function daysSinceVerified(isoDate: string, now = new Date()): number {
  const then = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
}

export function isPolicyPackStale(now = new Date()): boolean {
  return POLICY_SOURCES.some((s) => {
    if (s.status === "unreachable" || s.status === "stale") return true;
    return daysSinceVerified(s.lastVerifiedAt, now) > POLICY_STALE_AFTER_DAYS;
  });
}

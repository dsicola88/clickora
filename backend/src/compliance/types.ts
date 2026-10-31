export type AdsPlatform = "google" | "microsoft";

export type RuleResultStatus = "PASS" | "FAIL" | "WARNING" | "NOT_CHECKED";

export type RuleSeverity = "critical" | "high" | "medium" | "low" | "info";

export type RuleCategory =
  | "original_content"
  | "commercial_transparency"
  | "claims"
  | "destination"
  | "tracking"
  | "privacy_security"
  | "meta";

export type ComplianceGate =
  | "unchecked"
  | "checking"
  | "needs_review"
  | "blocked"
  | "ready_for_review";

export type RuleDefinition = {
  id: string;
  name: string;
  description: string;
  platforms: AdsPlatform[];
  category: RuleCategory;
  severity: RuleSeverity;
  sourceIds: string[];
  sourceReviewedAt: string;
};

export type RuleEvidence = {
  summary: string;
  details?: string[];
  excerpt?: string;
};

export type RuleResult = {
  ruleId: string;
  name: string;
  description: string;
  platforms: AdsPlatform[];
  category: RuleCategory;
  severity: RuleSeverity;
  status: RuleResultStatus;
  confidence: number; // 0–1
  evidence: RuleEvidence;
  remediation: string;
  sourceIds: string[];
  sourceReviewedAt: string;
};

export type DestinationProbeResult = {
  attempted: boolean;
  ok: boolean;
  https: boolean | null;
  statusCode: number | null;
  finalUrl: string | null;
  redirectCount: number;
  redirectCycle: boolean;
  openRedirectSuspect: boolean;
  domainChanged: boolean;
  initialHost: string | null;
  finalHost: string | null;
  crawlerBlocked: boolean;
  errorCode?:
    | "ssrf_blocked"
    | "body_too_large"
    | "timeout"
    | "network"
    | "redirect_limit"
    | "invalid_url"
    | "service_unavailable";
  errorMessage?: string;
  hops: string[];
};

export type TrackingProbeResult = {
  attempted: boolean;
  gclidPreserved: boolean | null;
  utmPreserved: boolean | null;
  msclkidPreserved: boolean | null;
  details: string[];
};

export type PresellComplianceSignals = {
  title: string;
  type: string;
  language: string;
  category: string | null;
  productName: string;
  salesText: string;
  subtitle: string;
  ctaText: string;
  imageCount: number;
  hasExternalCta: boolean;
  affiliateLink: string | null;
  sourceUrl: string | null;
  mirrorHtmlLength: number;
  mirrorHtml: string;
  bodyTextLength: number;
  wordCount: number;
  uniqueSentenceCount: number;
  hasAffiliateDisclosure: boolean;
  hasBusinessIdentity: boolean;
  businessName: string | null;
  contactEmail: string | null;
  privacyPolicyUrl: string | null;
  cookiePolicyUrl: string | null;
  claimsText: string;
  healthCureClaim: boolean;
  guaranteedResultClaim: boolean;
  unsourcedTestimonialOrStudy: boolean;
  inventedPriceSignal: boolean;
  priceMention: string | null;
  priceVerifiedFromSource: boolean | null;
  maliciousScriptInImport: boolean;
  cloakingEnabled: boolean;
  exitPopup: boolean;
  offerHost: string | null;
  pageHostHint: string | null;
  contentFingerprint: string;
  generationNiche: "black" | "white" | null;
};

export type EvaluateComplianceInput = {
  signals: PresellComplianceSignals;
  destination?: DestinationProbeResult | null;
  tracking?: TrackingProbeResult | null;
  /** Força META-001 (testes / pacote desatualizado). */
  forcePolicyStale?: boolean;
  /** Força META-002 (serviço indisponível). */
  auditServiceUnavailable?: boolean;
  now?: Date;
};

export type PlatformComplianceSummary = {
  platform: AdsPlatform;
  gate: ComplianceGate;
  passCount: number;
  failCount: number;
  warningCount: number;
  notCheckedCount: number;
  criticalFailCount: number;
};

export type ComplianceEvaluation = {
  rulesVersion: string;
  evaluatedAt: string;
  gate: ComplianceGate;
  google: PlatformComplianceSummary;
  microsoft: PlatformComplianceSummary;
  results: RuleResult[];
  contentFingerprint: string;
  disclaimer: string;
};

export const COMPLIANCE_DISCLAIMER =
  "Verificações internas do Clickora. A aprovação final depende do Google Ads e/ou Microsoft Advertising; não há garantia de aprovação nem imunidade a suspensões.";

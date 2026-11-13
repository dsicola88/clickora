import type { MessageKey } from "@/i18n";

/**
 * Passos do hub Integrações — IDs iguais a `account_health.checks` no backend.
 * Fonte única de alinhamento FE↔BE para go-live operacional.
 */
export const ACCOUNT_HEALTH_HUB_STEPS = [
  {
    id: "presell_published",
    href: "/presells/nova",
    titleKey: "pages.integrations.stepPresell" as MessageKey,
    descKey: "pages.integrations.stepPresellDesc" as MessageKey,
  },
  {
    id: "postback_plan",
    href: "/planos",
    titleKey: "pages.integrations.stepPostbackPlan" as MessageKey,
    descKey: "pages.integrations.stepPostbackPlanDesc" as MessageKey,
  },
  {
    id: "postback_configured",
    href: "/integracoes/postback",
    titleKey: "pages.integrations.stepPostback" as MessageKey,
    descKey: "pages.integrations.stepPostbackDesc" as MessageKey,
  },
  {
    id: "campaign_linked",
    href: "/campanhas",
    titleKey: "pages.integrations.stepCampaign" as MessageKey,
    descKey: "pages.integrations.stepCampaignDesc" as MessageKey,
  },
  {
    id: "macros",
    href: "/tracking/url-builder",
    titleKey: "pages.integrations.stepMacros" as MessageKey,
    descKey: "pages.integrations.stepMacrosDesc" as MessageKey,
  },
  {
    id: "google_ads",
    href: "/integracoes/google-ads",
    titleKey: "pages.integrations.stepGoogle" as MessageKey,
    descKey: "pages.integrations.stepGoogleDesc" as MessageKey,
  },
  {
    id: "meta_capi_configured",
    href: "/integracoes/pixels",
    titleKey: "pages.integrations.stepMetaCapi" as MessageKey,
    descKey: "pages.integrations.stepMetaCapiDesc" as MessageKey,
  },
  {
    id: "tiktok_events_configured",
    href: "/integracoes/pixels",
    titleKey: "pages.integrations.stepTiktokEvents" as MessageKey,
    descKey: "pages.integrations.stepTiktokEventsDesc" as MessageKey,
  },
  {
    id: "cost_sync",
    href: "/integracoes/automizer",
    titleKey: "pages.integrations.stepCosts" as MessageKey,
    descKey: "pages.integrations.stepCostsDesc" as MessageKey,
  },
  {
    id: "attribution",
    href: "/resultados/relatorios/conversoes",
    titleKey: "pages.integrations.stepAttribution" as MessageKey,
    descKey: "pages.integrations.stepAttributionDesc" as MessageKey,
  },
  {
    id: "ads_upload",
    href: "/resultados/relatorios/conversoes",
    titleKey: "pages.integrations.stepAdsUpload" as MessageKey,
    descKey: "pages.integrations.stepAdsUploadDesc" as MessageKey,
  },
  {
    id: "domain_https",
    href: "/configuracoes/dominio",
    titleKey: "pages.integrations.stepDomain" as MessageKey,
    descKey: "pages.integrations.stepDomainDesc" as MessageKey,
  },
] as const;

export type AccountHealthHubStepId = (typeof ACCOUNT_HEALTH_HUB_STEPS)[number]["id"];

/** Mapeia passos do Setup Assistant → checks de account_health. */
export const SETUP_ASSISTANT_HEALTH_MAP = {
  domain: "domain_https",
  presell: "presell_published",
  postback: "postback_configured",
  google: "google_ads",
  capi_meta: "meta_capi_configured",
  capi_tiktok: "tiktok_events_configured",
} as const;

export function accountHealthCheckOk(
  checks: Array<{ id: string; ok: boolean; detail?: string }> | undefined,
  id: string,
): { found: boolean; ok: boolean; detail?: string } {
  const c = checks?.find((x) => x.id === id);
  if (!c) return { found: false, ok: false };
  return { found: true, ok: c.ok, detail: c.detail };
}

export type AccountHealthCheckRow = {
  id: string;
  ok: boolean;
  detail?: string;
  title?: string;
  href?: string;
};

/** Primeiro check falhado na ordem canónica do hub — next-action partilhado. */
export function getNextAccountHealthStep(
  checks: AccountHealthCheckRow[] | undefined | null,
): {
  id: string;
  href: string;
  titleKey: MessageKey;
  descKey: MessageKey;
  detail?: string;
} | null {
  if (!checks?.length) return null;
  for (const step of ACCOUNT_HEALTH_HUB_STEPS) {
    const check = checks.find((c) => c.id === step.id);
    if (check && check.ok === false) {
      return {
        id: step.id,
        href: check.href?.trim() || step.href,
        titleKey: step.titleKey,
        descKey: step.descKey,
        detail: check.detail,
      };
    }
  }
  return null;
}

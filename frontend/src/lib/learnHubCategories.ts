/**
 * Centro «Aprender» — categorias e atalhos (estilo knowledge base / Learn).
 * Textos via i18n (`pages.help.hub.*`); rotas alinhadas à UX actual.
 */

import type { MessageKey } from "@/i18n";

export type LearnHubLinkDef = {
  to: string;
  labelKey: MessageKey;
  hintKey?: MessageKey;
};

export type LearnHubCategoryDef = {
  id: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  links: LearnHubLinkDef[];
  /** Tokens multi-idioma para pesquisa (sem i18n). */
  keywords?: string[];
};

/** Resolved for UI/search after `t(...)`. */
export type LearnHubLink = {
  to: string;
  label: string;
  hint?: string;
};

export type LearnHubCategory = {
  id: string;
  title: string;
  description: string;
  links: LearnHubLink[];
  keywords?: string[];
};

export const LEARN_HUB_SECTION_PERCURSOS_ID = "percursos-guiados";

export const LEARN_HUB_CATEGORY_DEFS: LearnHubCategoryDef[] = [
  {
    id: "comecar",
    titleKey: "pages.help.hub.comecarTitle",
    descriptionKey: "pages.help.hub.comecarDesc",
    keywords: ["início", "inicio", "onboarding", "tutorial", "wordpress", "domínio", "domain", "start"],
    links: [
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        labelKey: "pages.help.hub.comecarPaths",
        hintKey: "pages.help.hub.comecarPathsHint",
      },
      { to: "/aulas", labelKey: "pages.help.hub.comecarLessons", hintKey: "pages.help.hub.comecarLessonsHint" },
      { to: "/inicio", labelKey: "pages.help.hub.comecarHome", hintKey: "pages.help.hub.comecarHomeHint" },
      {
        to: "/presells/nova",
        labelKey: "pages.help.hub.comecarCreate",
        hintKey: "pages.help.hub.comecarCreateHint",
      },
      {
        to: "/integracoes",
        labelKey: "pages.help.hub.comecarIntegrations",
        hintKey: "pages.help.hub.comecarIntegrationsHint",
      },
      {
        to: "/ajuda/assistente",
        labelKey: "pages.help.hub.comecarAssistant",
        hintKey: "pages.help.hub.comecarAssistantHint",
      },
      {
        to: "/guia-vendas-afiliados",
        labelKey: "pages.help.hub.comecarGuide",
        hintKey: "pages.help.hub.comecarGuideHint",
      },
    ],
  },
  {
    id: "presells",
    titleKey: "pages.help.hub.presellsTitle",
    descriptionKey: "pages.help.hub.presellsDesc",
    keywords: ["landing", "builder", "slug", "dns", "ssl"],
    links: [
      { to: "/presells", labelKey: "pages.help.hub.presellsList", hintKey: "pages.help.hub.presellsListHint" },
      { to: "/presells/nova", labelKey: "pages.help.hub.presellsNew", hintKey: "pages.help.hub.presellsNewHint" },
      {
        to: "/presell/builder",
        labelKey: "pages.help.hub.presellsBuilder",
        hintKey: "pages.help.hub.presellsBuilderHint",
      },
      {
        to: "/presell/paginas-criadas",
        labelKey: "pages.help.hub.presellsManual",
        hintKey: "pages.help.hub.presellsManualHint",
      },
      {
        to: "/configuracoes/dominio",
        labelKey: "pages.help.hub.presellsDomain",
        hintKey: "pages.help.hub.presellsDomainHint",
      },
    ],
  },
  {
    id: "rastreamento",
    titleKey: "pages.help.hub.trackingTitle",
    descriptionKey: "pages.help.hub.trackingDesc",
    keywords: ["tracking", "utm", "gclid", "fbclid", "ttclid", "click", "campanha"],
    links: [
      {
        to: "/campanhas",
        labelKey: "pages.help.hub.trackingCampaigns",
        hintKey: "pages.help.hub.trackingCampaignsHint",
      },
      {
        to: "/resultados",
        labelKey: "pages.help.hub.trackingResults",
        hintKey: "pages.help.hub.trackingResultsHint",
      },
      {
        to: "/tracking/url-builder",
        labelKey: "pages.help.hub.trackingUrlBuilder",
        hintKey: "pages.help.hub.trackingUrlBuilderHint",
      },
      {
        to: "/tracking/rotadores",
        labelKey: "pages.help.hub.trackingRotators",
        hintKey: "pages.help.hub.trackingRotatorsHint",
      },
      {
        to: "/tracking/tools/gclid",
        labelKey: "pages.help.hub.trackingGclid",
        hintKey: "pages.help.hub.trackingGclidHint",
      },
    ],
  },
  {
    id: "conversoes",
    titleKey: "pages.help.hub.postbackTitle",
    descriptionKey: "pages.help.hub.postbackDesc",
    keywords: ["buygoods", "smartadv", "digistore", "hotmart", "postback", "webhook", "subid", "sub3", "cid"],
    links: [
      {
        to: "/integracoes/postback",
        labelKey: "pages.help.hub.postbackByNetwork",
        hintKey: "pages.help.hub.postbackByNetworkHint",
      },
      {
        to: "/integracoes",
        labelKey: "pages.help.hub.postbackHub",
        hintKey: "pages.help.hub.postbackHubHint",
      },
      {
        to: "/resultados/conversoes",
        labelKey: "pages.help.hub.postbackConversions",
        hintKey: "pages.help.hub.postbackConversionsHint",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        labelKey: "pages.help.hub.postbackNoGclid",
        hintKey: "pages.help.hub.postbackNoGclidHint",
      },
    ],
  },
  {
    id: "relatorios-analytics",
    titleKey: "pages.help.hub.reportsTitle",
    descriptionKey: "pages.help.hub.reportsDesc",
    keywords: ["roi", "roas", "export", "métricas", "metrics"],
    links: [
      {
        to: "/resultados",
        labelKey: "pages.help.hub.reportsOverview",
        hintKey: "pages.help.hub.reportsOverviewHint",
      },
      { to: "/resultados/conversoes", labelKey: "pages.help.hub.reportsConversions" },
      {
        to: "/resultados/relatorios",
        labelKey: "pages.help.hub.reportsEvents",
        hintKey: "pages.help.hub.reportsEventsHint",
      },
      {
        to: "/resultados/por-presell/presells",
        labelKey: "pages.help.hub.reportsByPresell",
        hintKey: "pages.help.hub.reportsByPresellHint",
      },
    ],
  },
  {
    id: "integracoes",
    titleKey: "pages.help.hub.adsTitle",
    descriptionKey: "pages.help.hub.adsDesc",
    keywords: ["telegram", "google ads", "meta", "tiktok", "capi", "offline"],
    links: [
      {
        to: "/integracoes/avancado",
        labelKey: "pages.help.hub.adsConnect",
        hintKey: "pages.help.hub.adsConnectHint",
      },
      { to: "/integracoes", labelKey: "pages.help.hub.adsHub", hintKey: "pages.help.hub.adsHubHint" },
      {
        to: "/tracking/tools/postbacks",
        labelKey: "pages.help.hub.adsTemplates",
        hintKey: "pages.help.hub.adsTemplatesHint",
      },
    ],
  },
  {
    id: "ferramentas",
    titleKey: "pages.help.hub.toolsTitle",
    descriptionKey: "pages.help.hub.toolsDesc",
    keywords: ["GCLID", "IP", "UUID", "logs"],
    links: [
      { to: "/tracking/tools", labelKey: "pages.help.hub.toolsIndex" },
      { to: "/tracking/tools/gclid", labelKey: "pages.help.hub.toolsGclid" },
      { to: "/tracking/tools/clique", labelKey: "pages.help.hub.toolsClick" },
      {
        to: "/tracking/logs",
        labelKey: "pages.help.hub.toolsLogs",
        hintKey: "pages.help.hub.toolsLogsHint",
      },
    ],
  },
  {
    id: "problemas",
    titleKey: "pages.help.hub.issuesTitle",
    descriptionKey: "pages.help.hub.issuesDesc",
    keywords: ["erro", "error", "falha", "postback", "suporte", "whatsapp", "email"],
    links: [
      {
        to: "/ajuda#suporte",
        labelKey: "pages.help.hub.issuesSupport",
        hintKey: "pages.help.hub.issuesSupportHint",
      },
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        labelKey: "pages.help.hub.issuesGuide",
        hintKey: "pages.help.hub.issuesGuideHint",
      },
      {
        to: "/integracoes/postback",
        labelKey: "pages.help.hub.issuesPostback",
        hintKey: "pages.help.hub.issuesPostbackHint",
      },
      { to: "/tracking/relatorios/sem-gclid", labelKey: "pages.help.hub.issuesNoGoogle" },
      { to: "/tracking/tools/clique", labelKey: "pages.help.hub.issuesConfirmClick" },
    ],
  },
  {
    id: "conta",
    titleKey: "pages.help.hub.accountTitle",
    descriptionKey: "pages.help.hub.accountDesc",
    keywords: ["perfil", "plano", "billing", "suporte", "contacto"],
    links: [
      { to: "/conta", labelKey: "pages.help.hub.accountSecurity" },
      {
        to: "/configuracoes",
        labelKey: "pages.help.hub.accountSettings",
        hintKey: "pages.help.hub.accountSettingsHint",
      },
      { to: "/planos", labelKey: "pages.help.hub.accountPlans" },
      {
        to: "/ajuda#suporte",
        labelKey: "pages.help.hub.accountContacts",
        hintKey: "pages.help.hub.accountContactsHint",
      },
    ],
  },
];

export function resolveLearnHubCategories(
  t: (key: MessageKey) => string,
): LearnHubCategory[] {
  return LEARN_HUB_CATEGORY_DEFS.map((cat) => ({
    id: cat.id,
    title: t(cat.titleKey),
    description: t(cat.descriptionKey),
    keywords: cat.keywords,
    links: cat.links.map((link) => ({
      to: link.to,
      label: t(link.labelKey),
      hint: link.hintKey ? t(link.hintKey) : undefined,
    })),
  }));
}

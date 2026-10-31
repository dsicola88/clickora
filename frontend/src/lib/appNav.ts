import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Zap,
  ClipboardList,
  Home,
  User,
  CreditCard,
  Settings2,
  Plug,
  Megaphone,
  ShieldAlert,
  Link2,
  Webhook,
  LineChart,
  Search,
  GraduationCap,
  HelpCircle,
  Shuffle,
  Stethoscope,
  Ban,
  ScrollText,
  LayoutTemplate,
  Rocket,
} from "lucide-react";
import type { AppMessages } from "@/i18n/messages/en";
import { en } from "@/i18n/messages/en";
import { pt } from "@/i18n/messages/pt";
import { ptBR } from "@/i18n/messages/pt-BR";
import { es } from "@/i18n/messages/es";
import type { MessageKey } from "@/i18n";

export type AppNavTitleKey = keyof AppMessages["nav"];
export type AppNavGroupKey = keyof AppMessages["navGroups"];

export type AppNavItem = {
  titleKey: AppNavTitleKey;
  url: string;
  icon: LucideIcon;
  /** Grupo no menu / command palette */
  group: AppNavGroupKey;
  end?: boolean;
  /** Sinónimos para a pesquisa (postback, ads, …) — multilíngue de propósito */
  keywords?: string[];
  /** Só staff */
  staffOnly?: boolean;
  /**
   * Se false, só aparece na pesquisa (⌘K), não na sidebar.
   * Páginas avançadas ligadas a partir de Configurações.
   */
  sidebar?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    titleKey: "home",
    url: "/inicio",
    icon: Home,
    group: "principal",
    end: true,
    keywords: ["home", "dashboard", "visão geral", "visao geral", "overview", "início", "inicio"],
  },
  {
    titleKey: "lessons",
    url: "/aulas",
    icon: GraduationCap,
    group: "principal",
    keywords: ["guia", "tutorial", "aprender", "help", "lições", "licoes", "aulas", "lessons"],
  },
  {
    titleKey: "agency",
    url: "/agency",
    icon: Rocket,
    group: "principal",
    keywords: ["agency", "profissional", "voluum", "renome", "onboarding"],
  },
  {
    titleKey: "presells",
    url: "/presells",
    icon: FileText,
    group: "trabalho",
    keywords: ["página", "pagina", "lander", "landing", "oferta", "espelho", "presell"],
  },
  {
    titleKey: "campaigns",
    url: "/campanhas",
    icon: Megaphone,
    group: "trabalho",
    keywords: ["campaign", "campanha", "tráfego", "trafego"],
  },
  {
    titleKey: "keywords",
    url: "/palavras-chave",
    icon: Search,
    group: "trabalho",
    keywords: ["keywords", "palavras", "keyword", "rsa", "anúncio", "anuncio", "copy"],
  },
  {
    titleKey: "urlBuilder",
    url: "/tracking/url-builder",
    icon: Link2,
    group: "trabalho",
    keywords: ["utm", "gclid", "link", "tracking", "rastreamento", "url builder"],
  },
  {
    titleKey: "results",
    url: "/resultados",
    icon: LayoutDashboard,
    group: "performance",
    end: true,
    keywords: ["métricas", "metricas", "overview", "performance", "cliques", "results"],
  },
  {
    titleKey: "funnel",
    url: "/resultados/funil",
    icon: LineChart,
    group: "performance",
    end: true,
    keywords: ["funil", "funnel", "checkout", "roi", "pago", "organico", "orgânico", "etapas"],
  },
  {
    titleKey: "conversions",
    url: "/resultados/relatorios/conversoes",
    icon: ClipboardList,
    group: "performance",
    end: true,
    keywords: ["vendas", "conversao", "conversions", "atribuídas", "atribuidas", "aprovadas"],
  },
  {
    titleKey: "reports",
    url: "/resultados/relatorios",
    icon: BarChart3,
    group: "performance",
    keywords: ["reports", "analytics", "gráficos", "graficos", "acessos", "relatórios", "relatorios"],
  },
  {
    titleKey: "integrations",
    url: "/integracoes",
    icon: Plug,
    group: "configuracao",
    keywords: ["hub", "plataformas", "conexões", "conexoes", "integrações", "integracoes"],
  },
  {
    titleKey: "networkSales",
    url: "/integracoes/postback",
    icon: Webhook,
    group: "configuracao",
    keywords: [
      "postback",
      "webhook",
      "maxweb",
      "buygoods",
      "clickbank",
      "s2s",
      "pixel",
      "comissao",
      "comissão",
      "rede afiliados",
    ],
  },
  {
    titleKey: "googleAds",
    url: "/integracoes/google-ads",
    icon: LineChart,
    group: "configuracao",
    keywords: ["ads", "gclid", "conversões offline", "conversoes offline", "roas", "google"],
  },
  {
    titleKey: "automizer",
    url: "/integracoes/automizer",
    icon: Zap,
    group: "configuracao",
    keywords: ["automizer", "custo", "spend", "gastos", "auto"],
  },
  {
    titleKey: "settings",
    url: "/configuracoes",
    icon: Settings2,
    group: "configuracao",
    keywords: ["settings", "preferências", "preferencias", "domínio", "dominio", "branding"],
  },
  {
    titleKey: "profile",
    url: "/conta",
    icon: User,
    group: "conta",
    end: true,
    keywords: ["account", "utilizador", "usuario", "email", "perfil"],
  },
  {
    titleKey: "plan",
    url: "/planos",
    icon: CreditCard,
    group: "conta",
    keywords: ["billing", "assinatura", "upgrade", "plans", "subscrição", "subscricao"],
  },
  {
    titleKey: "admin",
    url: "/admin/overview",
    icon: ShieldAlert,
    group: "conta",
    staffOnly: true,
    keywords: ["staff", "painel admin"],
  },
  {
    titleKey: "help",
    url: "/ajuda",
    icon: HelpCircle,
    group: "avancado",
    sidebar: false,
    keywords: ["ajuda", "faq", "suporte", "documentação", "documentacao", "help"],
  },
  {
    titleKey: "rotators",
    url: "/tracking/rotadores",
    icon: Shuffle,
    group: "avancado",
    sidebar: false,
    keywords: ["rotador", "ab", "a/b", "split", "teste", "rotators"],
  },
  {
    titleKey: "diagnostics",
    url: "/tracking/tools",
    icon: Stethoscope,
    group: "avancado",
    sidebar: false,
    keywords: ["tools", "ferramentas", "health", "saúde", "saude", "diagnóstico"],
  },
  {
    titleKey: "ipProtections",
    url: "/tracking/blacklist",
    icon: Ban,
    group: "avancado",
    sidebar: false,
    keywords: ["blacklist", "bot", "cloak", "firewall", "protecao", "proteção", "ip"],
  },
  {
    titleKey: "logs",
    url: "/tracking/logs",
    icon: ScrollText,
    group: "avancado",
    sidebar: false,
    keywords: ["logs", "eventos", "auditoria", "histórico", "historico", "registos", "registros"],
  },
  {
    titleKey: "manualPages",
    url: "/presell/paginas-criadas",
    icon: LayoutTemplate,
    group: "avancado",
    sidebar: false,
    keywords: ["builder", "editor", "manual", "templates"],
  },
  {
    titleKey: "dpilot",
    url: "/tracking/dpilot",
    icon: Rocket,
    group: "avancado",
    sidebar: false,
    keywords: ["dpilot", "google wizard", "campanha google"],
  },
];

/** @deprecated Preferir `t(\`navGroups.${group}\`)` — mantido para testes estáticos PT. */
export const APP_NAV_GROUP_LABEL: Record<AppNavItem["group"], string> = {
  principal: pt.navGroups.principal,
  trabalho: pt.navGroups.trabalho,
  performance: pt.navGroups.performance,
  configuracao: pt.navGroups.configuracao,
  conta: pt.navGroups.conta,
  avancado: pt.navGroups.avancado,
};

export function navTitleKeyPath(titleKey: AppNavTitleKey): MessageKey {
  return `nav.${titleKey}` as MessageKey;
}

export function navGroupKeyPath(group: AppNavGroupKey): MessageKey {
  return `navGroups.${group}` as MessageKey;
}

/** Normaliza texto para pesquisa (sem acentos, minúsculas). */
export function normalizeNavSearchText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function isAppNavActive(url: string, path: string, end?: boolean): boolean {
  // Relatórios cobre /resultados/relatorios/* excepto a aba Conversões.
  if (url === "/resultados/relatorios") {
    if (path === "/resultados/relatorios/conversoes" || path.startsWith("/resultados/relatorios/conversoes/")) {
      return false;
    }
    return path === url || path.startsWith(`${url}/`);
  }
  if (end) return path === url;
  if (path === url) return true;
  if (url !== "/" && path.startsWith(`${url}/`)) return true;
  return false;
}

/** Valor único para cmdk — inclui títulos en/pt/pt-BR/es para pesquisa em qualquer idioma. */
export function appNavSearchValue(item: AppNavItem): string {
  const titles = [
    en.nav[item.titleKey],
    pt.nav[item.titleKey],
    ptBR.nav[item.titleKey],
    es.nav[item.titleKey],
  ];
  return [item.url, ...titles, ...(item.keywords ?? [])].join(" ");
}

export function appNavMatchesQuery(item: AppNavItem, query: string): boolean {
  const q = normalizeNavSearchText(query);
  if (!q) return true;
  return normalizeNavSearchText(appNavSearchValue(item)).includes(q);
}

export function sidebarNavItems(staff: boolean): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => {
    if (item.sidebar === false) return false;
    if (item.staffOnly && !staff) return false;
    return true;
  });
}

export function commandNavItems(staff: boolean): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => (item.staffOnly ? staff : true));
}

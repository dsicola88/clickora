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

export type AppNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Grupo no menu / command palette */
  group: "principal" | "trabalho" | "performance" | "configuracao" | "conta" | "avancado";
  end?: boolean;
  /** Sinónimos para a pesquisa (postback, ads, …) */
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
    title: "Início",
    url: "/inicio",
    icon: Home,
    group: "principal",
    end: true,
    keywords: ["home", "dashboard", "visão geral", "visao geral", "overview"],
  },
  {
    title: "Aulas",
    url: "/aulas",
    icon: GraduationCap,
    group: "principal",
    keywords: ["guia", "tutorial", "aprender", "help", "lições", "licoes"],
  },
  {
    title: "Presells",
    url: "/presells",
    icon: FileText,
    group: "trabalho",
    keywords: ["página", "pagina", "lander", "landing", "oferta", "espelho", "presell"],
  },
  {
    title: "Campanhas",
    url: "/campanhas",
    icon: Megaphone,
    group: "trabalho",
    keywords: ["campaign", "campanha", "tráfego", "trafego"],
  },
  {
    title: "Pesquisa e anúncios",
    url: "/palavras-chave",
    icon: Search,
    group: "trabalho",
    keywords: ["keywords", "palavras", "keyword", "rsa", "anúncio", "anuncio", "copy"],
  },
  {
    title: "Construtor de URL",
    url: "/tracking/url-builder",
    icon: Link2,
    group: "trabalho",
    keywords: ["utm", "gclid", "link", "tracking", "rastreamento", "url builder"],
  },
  {
    title: "Resultados",
    url: "/resultados",
    icon: LayoutDashboard,
    group: "performance",
    end: true,
    keywords: ["métricas", "metricas", "overview", "performance", "cliques"],
  },
  {
    title: "Conversões",
    url: "/resultados/relatorios/conversoes",
    icon: ClipboardList,
    group: "performance",
    end: true,
    keywords: ["vendas", "conversao", "conversions", "atribuídas", "atribuidas", "aprovadas"],
  },
  {
    title: "Relatórios",
    url: "/resultados/relatorios",
    icon: BarChart3,
    group: "performance",
    keywords: ["reports", "analytics", "gráficos", "graficos", "acessos", "funil"],
  },
  {
    title: "Integrações",
    url: "/integracoes",
    icon: Plug,
    group: "configuracao",
    keywords: ["hub", "plataformas", "conexões", "conexoes"],
  },
  {
    title: "Vendas da rede",
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
    title: "Google Ads",
    url: "/integracoes/google-ads",
    icon: LineChart,
    group: "configuracao",
    keywords: ["ads", "gclid", "conversões offline", "conversoes offline", "roas", "google"],
  },
  {
    title: "Custos automáticos",
    url: "/integracoes/automizer",
    icon: Zap,
    group: "configuracao",
    keywords: ["automizer", "custo", "spend", "gastos", "auto"],
  },
  {
    title: "Configurações",
    url: "/configuracoes",
    icon: Settings2,
    group: "configuracao",
    keywords: ["settings", "preferências", "preferencias", "domínio", "dominio", "branding"],
  },
  {
    title: "Perfil",
    url: "/conta",
    icon: User,
    group: "conta",
    end: true,
    keywords: ["account", "utilizador", "usuario", "email", "perfil"],
  },
  {
    title: "Plano",
    url: "/planos",
    icon: CreditCard,
    group: "conta",
    keywords: ["billing", "assinatura", "upgrade", "plans", "subscrição", "subscricao"],
  },
  {
    title: "Admin",
    url: "/admin/overview",
    icon: ShieldAlert,
    group: "conta",
    staffOnly: true,
    keywords: ["staff", "painel admin"],
  },
  // Só ⌘K — descoberta das páginas ligadas em Configurações
  {
    title: "Ajuda",
    url: "/ajuda",
    icon: HelpCircle,
    group: "avancado",
    sidebar: false,
    keywords: ["ajuda", "faq", "suporte", "documentação", "documentacao"],
  },
  {
    title: "Rotadores A/B",
    url: "/tracking/rotadores",
    icon: Shuffle,
    group: "avancado",
    sidebar: false,
    keywords: ["rotador", "ab", "a/b", "split", "teste"],
  },
  {
    title: "Diagnóstico",
    url: "/tracking/tools",
    icon: Stethoscope,
    group: "avancado",
    sidebar: false,
    keywords: ["tools", "ferramentas", "health", "saúde", "saude"],
  },
  {
    title: "IP e protecções",
    url: "/tracking/blacklist",
    icon: Ban,
    group: "avancado",
    sidebar: false,
    keywords: ["blacklist", "bot", "cloak", "firewall", "protecao", "proteção", "ip"],
  },
  {
    title: "Registos",
    url: "/tracking/logs",
    icon: ScrollText,
    group: "avancado",
    sidebar: false,
    keywords: ["logs", "eventos", "auditoria", "histórico", "historico"],
  },
  {
    title: "Páginas manuais",
    url: "/presell/paginas-criadas",
    icon: LayoutTemplate,
    group: "avancado",
    sidebar: false,
    keywords: ["builder", "editor", "manual", "templates"],
  },
  {
    title: "dPilot",
    url: "/tracking/dpilot",
    icon: Rocket,
    group: "avancado",
    sidebar: false,
    keywords: ["dpilot", "google wizard", "campanha google"],
  },
];

export const APP_NAV_GROUP_LABEL: Record<AppNavItem["group"], string> = {
  principal: "Principal",
  trabalho: "Trabalho",
  performance: "Performance",
  configuracao: "Configuração",
  conta: "Conta",
  avancado: "Avançado",
};

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

/** Valor único para cmdk (url primeiro evita colisões entre itens). */
export function appNavSearchValue(item: AppNavItem): string {
  return [item.url, item.title, ...(item.keywords ?? [])].join(" ");
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

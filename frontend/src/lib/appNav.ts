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
} from "lucide-react";

export type AppNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Grupo no menu / command palette */
  group: "principal" | "trabalho" | "performance" | "configuracao" | "conta";
  end?: boolean;
  /** Sinónimos para a pesquisa (postback, ads, …) */
  keywords?: string[];
  /** Só staff */
  staffOnly?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    title: "Início",
    url: "/inicio",
    icon: Home,
    group: "principal",
    end: true,
    keywords: ["home", "dashboard", "visão geral", "visao geral"],
  },
  {
    title: "Aulas",
    url: "/aulas",
    icon: GraduationCap,
    group: "principal",
    keywords: ["guia", "tutorial", "aprender", "help"],
  },
  {
    title: "Presells",
    url: "/presells",
    icon: FileText,
    group: "trabalho",
    keywords: ["página", "pagina", "lander", "landing", "oferta", "espelho"],
  },
  {
    title: "Campanhas",
    url: "/campanhas",
    icon: Megaphone,
    group: "trabalho",
    keywords: ["campaign", "ads", "tráfego", "trafego"],
  },
  {
    title: "Pesquisa e anúncios",
    url: "/palavras-chave",
    icon: Search,
    group: "trabalho",
    keywords: ["keywords", "palavras", "keyword", "rsa", "anúncio", "anuncio"],
  },
  {
    title: "Construtor de URL",
    url: "/tracking/url-builder",
    icon: Link2,
    group: "trabalho",
    keywords: ["utm", "gclid", "link", "tracking", "rastreamento"],
  },
  {
    title: "Resultados",
    url: "/resultados",
    icon: LayoutDashboard,
    group: "performance",
    end: true,
    keywords: ["métricas", "metricas", "overview", "performance"],
  },
  {
    title: "Conversões",
    url: "/resultados/relatorios/conversoes",
    icon: ClipboardList,
    group: "performance",
    end: true,
    keywords: ["vendas", "postback", "conversao", "conversions", "atribuídas", "atribuidas"],
  },
  {
    title: "Relatórios",
    url: "/resultados/relatorios",
    icon: BarChart3,
    group: "performance",
    end: true,
    keywords: ["reports", "analytics", "gráficos", "graficos"],
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
    ],
  },
  {
    title: "Google Ads",
    url: "/integracoes/google-ads",
    icon: LineChart,
    group: "configuracao",
    keywords: ["ads", "gclid", "conversões offline", "conversoes offline", "roas"],
  },
  {
    title: "Custos automáticos",
    url: "/integracoes/automizer",
    icon: Zap,
    group: "configuracao",
    keywords: ["automizer", "custo", "spend", "gastos"],
  },
  {
    title: "Configurações",
    url: "/configuracoes",
    icon: Settings2,
    group: "configuracao",
    keywords: ["settings", "conta", "preferências", "preferencias", "domínio", "dominio"],
  },
  {
    title: "Perfil",
    url: "/conta",
    icon: User,
    group: "conta",
    end: true,
    keywords: ["account", "utilizador", "usuario", "email"],
  },
  {
    title: "Plano",
    url: "/planos",
    icon: CreditCard,
    group: "conta",
    keywords: ["billing", "assinatura", "upgrade", "plans"],
  },
  {
    title: "Admin",
    url: "/admin/overview",
    icon: ShieldAlert,
    group: "conta",
    staffOnly: true,
    keywords: ["staff", "painel admin"],
  },
];

export const APP_NAV_GROUP_LABEL: Record<AppNavItem["group"], string> = {
  principal: "Principal",
  trabalho: "Trabalho",
  performance: "Performance",
  configuracao: "Configuração",
  conta: "Conta",
};

export function isAppNavActive(url: string, path: string, end?: boolean): boolean {
  if (end) return path === url;
  if (path === url) return true;
  if (url !== "/" && path.startsWith(`${url}/`)) return true;
  return false;
}

export function appNavSearchValue(item: AppNavItem): string {
  return [item.title, item.url, ...(item.keywords ?? [])].join(" ");
}

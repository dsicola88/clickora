/**
 * Centro «Aprender» — categorias e atalhos (estilo knowledge base / Learn).
 * Cada entrada liga a rotas reais do painel ou a âncoras na própria página /ajuda.
 */

export type LearnHubLink = {
  to: string;
  label: string;
  /** Texto extra para pesquisa e contexto (não é obrigatório mostrar na UI). */
  hint?: string;
};

export type LearnHubCategory = {
  id: string;
  title: string;
  description: string;
  links: LearnHubLink[];
  /** Palavras para filtro (sinónimos, redes, etc.). */
  keywords?: string[];
};

export const LEARN_HUB_SECTION_PERCURSOS_ID = "percursos-guiados";

export const LEARN_HUB_CATEGORIES: LearnHubCategory[] = [
  {
    id: "comecar",
    title: "Começar",
    description: "Visão geral do produto e por onde começar depois do login.",
    keywords: ["início", "onboarding", "primeiros passos", "fluxo"],
    links: [
      {
        to: "/tracking/setup-assistant",
        label: "Assistente de configuração (checklist)",
        hint: "Presell, tracking, postback e Google Ads com estado da conta",
      },
      { to: "/inicio", label: "Escolher área (início)", hint: "Dashboard de entrada" },
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        label: "Percursos guiados (passo a passo)",
        hint: "Accordion clique venda",
      },
      {
        to: "/guia-vendas-afiliados",
        label: "Artigo longo — presell e afiliados (público)",
        hint: "SEO guia vendas",
      },
    ],
  },
  {
    id: "presells",
    title: "Presells",
    description: "Criar, publicar e partilhar páginas intermediárias (/p/…).",
    keywords: ["landing", "página", "builder", "slug", "público"],
    links: [
      { to: "/presell/dashboard", label: "Lista e nova presell", hint: "Nome da página, slug e URL /p/…" },
      {
        to: "/presell/builder",
        label: "Editor manual (página visual)",
        hint: "Mesmo link público /p/… que as presells automáticas",
      },
      { to: "/presell/paginas-criadas", label: "Páginas criadas (lista manual)", hint: "Exportar ou remover HTML" },
      { to: "/presell/templates/editor", label: "Modelos e criador", hint: "templates" },
      {
        to: "/tracking/url-builder",
        label: "Construtor de URL da presell",
        hint: "UTMs, macros ValueTrack, sufixo Google Ads",
      },
    ],
  },
  {
    id: "rastreamento",
    title: "Rastreamento e links",
    description: "Medição de cliques, UTMs, macros das redes e rotadores.",
    keywords: ["tracking", "utm", "gclid", "click", "redirect"],
    links: [
      { to: "/tracking/dashboard", label: "Resumo e guia (KPIs, script, Google Ads)", hint: "Script só para HTML externo; /p/… já mede" },
      { to: "/tracking/links", label: "Links de tracking", hint: "Macros das redes (Google, Meta, Bing…)" },
      { to: "/tracking/url-builder", label: "Construtor de URL", hint: "Copiar sufixo para o Google Ads" },
      { to: "/tracking/rotadores", label: "Rotadores de tráfego", hint: "A/B, geo, dispositivo" },
      {
        to: "/tracking/blacklist",
        label: "IP e proteções (blacklist / whitelist)",
        hint: "Bloquear IPs ou padrões; reduzir cliques inválidos",
      },
      { to: "/tracking/tools", label: "Tracking Tools (índice)", hint: "GCLID, clique UUID, postbacks" },
    ],
  },
  {
    id: "conversoes",
    title: "Conversões e plataformas",
    description: "Postbacks, redes de afiliados e fecho do funil até à venda.",
    keywords: ["hotmart", "postback", "webhook", "venda", "afiliado"],
    links: [
      { to: "/tracking/plataformas", label: "Plataformas e URL de postback", hint: "Hotmart, macros, e-mail de alerta" },
      { to: "/tracking/vendas", label: "Vendas (funil)", hint: "Etapas até à venda aprovada" },
      {
        to: "/tracking/relatorios/conversoes",
        label: "Relatórios → Conversões",
        hint: "Exportar GCLID para Google Ads",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        label: "Relatórios → Conversões sem GCLID",
        hint: "Diagnosticar atribuição Google",
      },
    ],
  },
  {
    id: "relatorios-analytics",
    title: "Relatórios e analytics",
    description: "Dados agregados, exportações e relatórios Google Ads (API).",
    keywords: ["métricas", "gráfico", "export", "GAQL", "palavras-chave"],
    links: [
      { to: "/tracking/relatorios/acessos", label: "Relatórios → Acessos", hint: "Impressões e visitas" },
      { to: "/tracking/relatorios/cliques", label: "Relatórios → Cliques", hint: "UTM, dispositivo, país" },
      {
        to: "/tracking/relatorios/conversoes",
        label: "Relatórios → Conversões",
        hint: "Sincronização Google/Meta",
      },
      { to: "/tracking/analytics/presells", label: "Analytics → Presells", hint: "Gráfico por página" },
      {
        to: "/tracking/analytics/google-ads/keywords",
        label: "Google Ads → Palavras-chave",
        hint: "API em tempo real",
      },
      {
        to: "/tracking/analytics/google-ads/search_terms",
        label: "Google Ads → Termos de pesquisa",
        hint: "Queries reais",
      },
      {
        to: "/tracking/analytics/google-ads/demographics",
        label: "Google Ads → Demografia",
        hint: "Idade e género",
      },
    ],
  },
  {
    id: "integracoes",
    title: "Integrações",
    description: "Notificações, Telegram, push e ligações externas.",
    keywords: ["telegram", "email", "web push", "csv google"],
    links: [
      {
        to: "/tracking/integrations",
        label: "Integrações (Telegram, Web Push, CSV Google)",
        hint: "Alertas de venda e upload offline",
      },
      { to: "/tracking/tools/postbacks", label: "Ferramentas → Modelos de postback", hint: "Microsoft, redes" },
    ],
  },
  {
    id: "ferramentas",
    title: "Ferramentas e diagnóstico",
    description: "Utilitários rápidos e registo de atividade.",
    keywords: ["GCLID", "IP", "UUID", "clique", "logs"],
    links: [
      { to: "/tracking/tools", label: "Tracking Tools — índice", hint: "Atalho para todas as ferramentas" },
      { to: "/tracking/tools/gclid", label: "GCLID no clique", hint: "Confirmar ID de clique Google" },
      { to: "/tracking/tools/clique", label: "Detalhe de clique (UUID)", hint: "Lookup estilo tracker" },
      { to: "/tracking/tools/ip", label: "Rastrear IP (GeoLite)", hint: "Origem aproximada" },
      { to: "/tracking/logs", label: "Registos (logs)", hint: "Histórico e auditoria" },
    ],
  },
  {
    id: "problemas",
    title: "Resolução de problemas",
    description: "Quando algo não bate certo: cliques, conversões, Google Ads ou tráfego suspeito.",
    keywords: [
      "erro",
      "falha",
      "não aparece",
      "troubleshoot",
      "diagnóstico",
      "postback",
      "gclid",
      "bot",
      "fraude",
    ],
    links: [
      {
        to: "/tracking/setup-assistant",
        label: "Assistente de configuração (checklist completa)",
        hint: "Ver estado da conta passo a passo",
      },
      {
        to: "/tracking/blacklist",
        label: "IP e proteções — bloquear tráfego inválido",
        hint: "Blacklist, whitelist, regras",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        label: "Conversões sem GCLID",
        hint: "Ver vendas sem ID Google no clique",
      },
      {
        to: "/tracking/plataformas",
        label: "Postback e subid (clickora_click_id)",
        hint: "Alinhar rede com o webhook",
      },
      {
        to: "/tracking/tools/clique",
        label: "Procurar um clique pelo UUID",
        hint: "Confirmar se o clique existiu",
      },
      {
        to: "/tracking/dashboard",
        label: "Resumo e guia — OAuth Google Ads",
        hint: "Token expirado, Customer ID, importação automática",
      },
      {
        to: "/tracking/logs",
        label: "Logs — ver o que o sistema registou",
        hint: "Postbacks e eventos recentes",
      },
      {
        to: "/tracking/integrations",
        label: "Integrações — SMTP e notificações",
        hint: "E-mail de teste e Telegram",
      },
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        label: "Rever o passo a passo (clique → venda)",
        hint: "Checklist no fim desta página",
      },
    ],
  },
  {
    id: "conta",
    title: "Conta e planos",
    description: "Perfil, palavra-passe, guia no painel e subscrição.",
    keywords: ["perfil", "senha", "billing", "plano"],
    links: [
      { to: "/conta", label: "Conta e preferências", hint: "perfil" },
      { to: "/tracking/settings", label: "Definições de rastreamento", hint: "workspace" },
      { to: "/plans", label: "Planos e subscrição", hint: "upgrade" },
      { to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`, label: "Voltar aos percursos guiados", hint: "ajuda" },
    ],
  },
];

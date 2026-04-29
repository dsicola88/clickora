/**
 * Centro «Aprender» — categorias e atalhos (estilo knowledge base / Learn).
 * Cada entrada liga a rotas reais do painel ou a âncoras na própria página /ajuda.
 * Copys orientados a linguagem simples; termos técnicos mantêm-se nos `keywords` para pesquisa.
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
  /** Palavras para filtro (sinónimos, redes, termos de power user). */
  keywords?: string[];
};

export const LEARN_HUB_SECTION_PERCURSOS_ID = "percursos-guiados";

export const LEARN_HUB_CATEGORIES: LearnHubCategory[] = [
  {
    id: "comecar",
    title: "Começar",
    description: "O que faz sentido logo após o login.",
    keywords: ["início", "onboarding", "primeiros passos", "fluxo", "tutorial"],
    links: [
      {
        to: "/tracking/setup-assistant",
        label: "Assistente (passos com checklist)",
        hint: "Do link da presell às redes — só o que falta conta como aviso",
      },
      { to: "/inicio", label: "Página inicial", hint: "Escolha presell, rastreamento ou anúncios" },
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        label: "Percursos passo a passo (nesta página)",
        hint: "Texto principal simples — detalhe técnico opcional dentro de cada bloco",
      },
      {
        to: "/guia-vendas-afiliados",
        label: "Artigo longo no site",
        hint: "Leitura fora do painel, com subtítulos mais longos",
      },
    ],
  },
  {
    id: "presells",
    title: "Presells",
    description: "Criar páginas de passagem antes da oferta e publicar o link /p/… nos anúncios.",
    keywords: ["landing", "página", "builder", "slug", "público", "template"],
    links: [
      { to: "/presell/dashboard", label: "Lista e nova presell", hint: "Nome, slug e endereço que partilha" },
      {
        to: "/presell/builder",
        label: "Editor manual (aspecto livre)",
        hint: "O link público continua em /p/… como nas presells rápidas",
      },
      { to: "/presell/paginas-criadas", label: "Páginas do editor manual", hint: "Abrir ou exportar" },
      { to: "/presell/templates/editor", label: "Modelos e criador guiado", hint: "" },
      {
        to: "/tracking/url-builder",
        label: "Construtor de URL para a presell",
        hint: "Gere texto pronto para colar nos anúncios (marcadores já incluídos quando aplicável)",
      },
    ],
  },
  {
    id: "rastreamento",
    title: "Rastreamento e links",
    description: "Contar visitas, montar links e repartir tráfego sem folha paralela.",
    keywords: ["tracking", "utm", "gclid", "click", "redirect", "rotador"],
    links: [
      {
        to: "/tracking/dashboard",
        label: "Resumo e guia",
        hint: "Números do período, script apenas se hospedar HTML manualmente — /p/… já conta sozinho",
      },
      { to: "/tracking/links", label: "Links de tracking", hint: "Macros sugeridas por rede quando existirem" },
      { to: "/tracking/url-builder", label: "Construtor de URL", hint: "Copiar texto para o campo sufixo do Google e similares" },
      {
        to: "/tracking/rotadores",
        label: "Um link, várias rotas",
        hint: "Dividir visitas por país, equipamento ou teste A/B",
      },
      {
        to: "/tracking/blacklist",
        label: "Bloquear IPs ou intervalos suspeitos",
        hint: "Menos ruído em campanhas com fraude clicável",
      },
      {
        to: "/tracking/tools",
        label: "Ferramentas de diagnóstico (índice)",
        hint: "Identificadores de clique Google, UUID, postbacks de exemplo",
      },
    ],
  },
  {
    id: "conversoes",
    title: "Conversões e plataformas",
    description: "Ligar vendas aos cliques vindos das redes de afiliação.",
    keywords: ["hotmart", "postback", "webhook", "venda", "afiliado", "plataforma"],
    links: [
      {
        to: "/tracking/plataformas",
        label: "Plataformas — endereço para a rede aceitar vendas aqui",
        hint: "Cole onde a rede pedir «avisos» ou URLs de servidor",
      },
      { to: "/tracking/vendas", label: "Funil até à venda aprovada", hint: "" },
      {
        to: "/tracking/relatorios/conversoes",
        label: "Relatório de conversões",
        hint: "Exportar quando precisar de ficheiros para o Google Ads",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        label: "Vendas sem ID Google no clique",
        hint: "Diagnóstico quando algo não aparece lá fora mas aparece aqui",
      },
    ],
  },
  {
    id: "relatorios-analytics",
    title: "Relatórios e números",
    description: "Tabelas com datas, vista rápida e ligações com o Google quando estiver configurado.",
    keywords: ["métricas", "gráfico", "export", "GAQL", "palavras-chave", "api"],
    links: [
      { to: "/tracking/relatorios/acessos", label: "Acessos (impressões / visitas)", hint: "" },
      { to: "/tracking/relatorios/cliques", label: "Cliques por dia", hint: "" },
      {
        to: "/tracking/relatorios/conversoes",
        label: "Conversões",
        hint: "Atualização quando há avisos da rede ou ligações extra",
      },
      { to: "/tracking/analytics/presells", label: "Vista rápida por presell", hint: "Curvas e totais por página" },
      {
        to: "/tracking/analytics/google-ads/keywords",
        label: "Google Ads — palavras de anúncio",
        hint: "Dados remotos quando a conta está ligada",
      },
      {
        to: "/tracking/analytics/google-ads/search_terms",
        label: "Google Ads — pesquisas reais dos utilizadores",
        hint: "",
      },
      {
        to: "/tracking/analytics/google-ads/demographics",
        label: "Google Ads — público (idade/género)",
        hint: "",
      },
    ],
  },
  {
    id: "integracoes",
    title: "Integrações",
    description: "Avisos (Telegram, browser, outros) quando o seu plano permitir.",
    keywords: ["telegram", "email", "web push", "csv google", "smtp"],
    links: [
      {
        to: "/tracking/integrations",
        label: "Integrações (Telegram, notificações, export CSV)",
        hint: "Experimentar envios de teste",
      },
      {
        to: "/tracking/tools/postbacks",
        label: "Modelos de exemplo para redes",
        hint: "Útil quando a rede lista vários fabricantes ou campos",
      },
    ],
  },
  {
    id: "ferramentas",
    title: "Ferramentas e diagnóstico",
    description: "Procuras pontuais (clique por ID, local do IP…) e registos do sistema.",
    keywords: ["GCLID", "IP", "UUID", "clique", "logs", "GeoLite"],
    links: [
      { to: "/tracking/tools", label: "Índice de ferramentas", hint: "" },
      {
        to: "/tracking/tools/gclid",
        label: "Confirmar se o clique do Google ficou marcado",
        hint: "",
      },
      { to: "/tracking/tools/clique", label: "Procurar um clique pelo identificador", hint: "" },
      { to: "/tracking/tools/ip", label: "De onde parece vir o IP", hint: "" },
      { to: "/tracking/logs", label: "Lista de registos recentes do sistema", hint: "" },
    ],
  },
  {
    id: "problemas",
    title: "Algo correu menos bem",
    description: "Onde rever quando falta número, aparece erro ou há tráfego estranho.",
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
        label: "Assistente completo da conta",
        hint: "Vê onde falta algo em verde/amarelo",
      },
      {
        to: "/tracking/blacklist",
        label: "Bloquear visitas indesejadas",
        hint: "",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        label: "Vendas sem ID Google na origem",
        hint: "",
      },
      {
        to: "/tracking/plataformas",
        label: "Código que a rede deve devolver ao comprar",
        hint: "Também aparece como identificação interno do clique nesta conta",
      },
      {
        to: "/tracking/tools/clique",
        label: "Confirmar um clique concreto",
        hint: "",
      },
      {
        to: "/tracking/dashboard",
        label: "Ligação ao Google Ads e número da conta",
        hint: "Token expira e precisa refrescar quando a própria Google pedir",
      },
      {
        to: "/tracking/logs",
        label: "Ver avisos de venda registados pelo sistema",
        hint: "",
      },
      {
        to: "/tracking/integrations",
        label: "E-mail ou Telegram de alerta",
        hint: "",
      },
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        label: "Revê o texto da secção Percursos guiados em baixo nesta página",
        hint: "",
      },
    ],
  },
  {
    id: "conta",
    title: "Conta e planos",
    description: "Os seus dados, equipa onde existir e o plano atual.",
    keywords: ["perfil", "senha", "billing", "plano"],
    links: [
      { to: "/conta", label: "Conta e segurança", hint: "" },
      { to: "/tracking/settings", label: "Definições nesta área de tracking", hint: "" },
      { to: "/plans", label: "Planos", hint: "" },
      { to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`, label: "Voltar aos percursos no fim da página Aprender", hint: "" },
    ],
  },
];

/**
 * Centro «Aprender» — categorias e atalhos (estilo knowledge base / Learn).
 * Rotas alinhadas à UX actual: Presells, Campanhas, Resultados, Integrações.
 */

export type LearnHubLink = {
  to: string;
  label: string;
  /** Texto extra para pesquisa e contexto. */
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

export const LEARN_HUB_CATEGORIES: LearnHubCategory[] = [
  {
    id: "comecar",
    title: "Começar",
    description: "Fluxo profissional: domínio → presell → postback → anúncio.",
    keywords: ["início", "onboarding", "primeiros passos", "tutorial", "wordpress", "domínio"],
    links: [
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        label: "Percursos passo a passo (nesta página)",
        hint: "Domínio, presell, GCLID, BuyGoods/SmartAdv, conversões",
      },
      { to: "/inicio", label: "Página inicial", hint: "Atalhos para criar e ver resultados" },
      { to: "/presells/nova", label: "Criar presell agora", hint: "Assistente Oferta → Campanha → Publicar" },
      { to: "/integracoes", label: "Integrações (postback + anúncios)", hint: "Obrigatório para vendas no painel" },
      {
        to: "/guia-vendas-afiliados",
        label: "Artigo longo no site",
        hint: "Leitura fora do painel",
      },
    ],
  },
  {
    id: "presells",
    title: "Presells",
    description: "Páginas sem WordPress — domínio próprio + link /p/… nos anúncios.",
    keywords: ["landing", "página", "builder", "slug", "domínio", "dns", "ssl"],
    links: [
      { to: "/presells", label: "Lista de presells", hint: "Publicadas e rascunhos" },
      { to: "/presells/nova", label: "Nova presell (assistente)", hint: "Importa a oferta e publica" },
      { to: "/presell/builder", label: "Editor manual", hint: "Layout livre; URL público continua /p/…" },
      { to: "/presell/paginas-criadas", label: "Páginas do editor manual", hint: "Abrir ou exportar" },
      { to: "/configuracoes", label: "Domínio personalizado", hint: "DNS verificado → https://seu-dominio/p/…" },
    ],
  },
  {
    id: "rastreamento",
    title: "Rastreamento e links",
    description: "Campanhas, UTMs, GCLID e o clique até à oferta.",
    keywords: ["tracking", "utm", "gclid", "fbclid", "ttclid", "click", "campanha"],
    links: [
      { to: "/campanhas", label: "Campanhas", hint: "Copiar URL do anúncio com UTMs" },
      { to: "/resultados", label: "Resultados (visão geral)", hint: "Cliques, receita, ROI" },
      {
        to: "/tracking/url-builder",
        label: "Construtor de URL (avançado)",
        hint: "Macros Google / Meta / BuyGoods",
      },
      {
        to: "/tracking/rotadores",
        label: "Rotadores",
        hint: "Um link, várias rotas (A/B, país)",
      },
      {
        to: "/tracking/tools/gclid",
        label: "Verificar GCLID de um clique",
        hint: "Confirmar se o Google ficou marcado",
      },
    ],
  },
  {
    id: "conversoes",
    title: "Postback e redes de afiliados",
    description: "Ligar vendas BuyGoods, SmartAdv, Digistore, Hotmart… ao clique.",
    keywords: [
      "buygoods",
      "smartadv",
      "digistore",
      "hotmart",
      "postback",
      "webhook",
      "subid",
      "sub3",
      "cid",
      "venda",
    ],
    links: [
      {
        to: "/tracking/plataformas-legacy",
        label: "Postback por rede (copiar URL com macros)",
        hint: "BuyGoods {SUBID} · SmartAdv {sub3} · Digistore {cid}",
      },
      { to: "/integracoes", label: "Hub Integrações", hint: "Fluxo em 4 passos" },
      {
        to: "/resultados/conversoes",
        label: "Conversões",
        hint: "Vendas atribuídas e não atribuídas",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        label: "Vendas sem GCLID no clique",
        hint: "Diagnóstico Google Ads",
      },
    ],
  },
  {
    id: "relatorios-analytics",
    title: "Relatórios e números",
    description: "Resultados, conversões e exports.",
    keywords: ["métricas", "roi", "roas", "export", "relatório"],
    links: [
      { to: "/resultados", label: "Visão geral", hint: "Lucro, ROAS, alertas" },
      { to: "/resultados/conversoes", label: "Conversões", hint: "" },
      { to: "/resultados/relatorios", label: "Relatórios", hint: "Acessos e cliques" },
      {
        to: "/tracking/analytics/presells",
        label: "Por presell",
        hint: "Curvas e totais por página",
      },
    ],
  },
  {
    id: "integracoes",
    title: "Anúncios (Google / Meta / TikTok)",
    description: "Enviar vendas aprovadas de volta às contas de ads.",
    keywords: ["telegram", "google ads", "meta", "tiktok", "capi", "offline"],
    links: [
      {
        to: "/tracking/integrations-legacy",
        label: "Ligar Google / Meta / TikTok",
        hint: "Requer GCLID/fbclid/ttclid no clique",
      },
      {
        to: "/integracoes",
        label: "Hub Integrações",
        hint: "Postback + anúncios",
      },
      {
        to: "/tracking/tools/postbacks",
        label: "Modelos de exemplo",
        hint: "Campos típicos por fabricante",
      },
    ],
  },
  {
    id: "ferramentas",
    title: "Ferramentas e diagnóstico",
    description: "GCLID, clique por ID, IP, logs.",
    keywords: ["GCLID", "IP", "UUID", "clique", "logs"],
    links: [
      { to: "/tracking/tools", label: "Índice de ferramentas", hint: "" },
      { to: "/tracking/tools/gclid", label: "Confirmar GCLID", hint: "" },
      { to: "/tracking/tools/clique", label: "Procurar clique por ID", hint: "" },
      { to: "/tracking/logs", label: "Logs do sistema", hint: "Avisos de postback" },
    ],
  },
  {
    id: "problemas",
    title: "Algo correu menos bem",
    description: "Sem vendas, sem GCLID, postback falhou.",
    keywords: ["erro", "falha", "não aparece", "postback", "gclid", "buygoods", "smartadv"],
    links: [
      {
        to: `/ajuda#${LEARN_HUB_SECTION_PERCURSOS_ID}`,
        label: "Revê o guia operacional completo",
        hint: "Passos 1–6 com BuyGoods/SmartAdv",
      },
      {
        to: "/tracking/plataformas-legacy",
        label: "Rever URL do postback",
        hint: "Macros têm de coincidir com a doc da rede",
      },
      {
        to: "/tracking/relatorios/sem-gclid",
        label: "Vendas sem ID Google",
        hint: "",
      },
      {
        to: "/tracking/tools/clique",
        label: "Confirmar um clique concreto",
        hint: "",
      },
      {
        to: "/tracking/logs",
        label: "Logs de postback",
        hint: "",
      },
    ],
  },
  {
    id: "conta",
    title: "Conta e planos",
    description: "Perfil, plano e webhook de afiliados.",
    keywords: ["perfil", "plano", "billing", "webhook"],
    links: [
      { to: "/conta", label: "Conta e segurança", hint: "" },
      { to: "/configuracoes", label: "Configurações", hint: "Domínio, avançado" },
      { to: "/planos", label: "Planos", hint: "Webhook de afiliados no plano" },
    ],
  },
];

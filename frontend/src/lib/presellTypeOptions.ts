/**
 * Opções de «Tipo de presell» no assistente — alinhadas ao comportamento real em `PublicPresell` / `presellTypeMeta`.
 * Cada tipo tem identidade visual própria e enquadramento de transparência (políticas de destino).
 * Não promete aprovação Google/Microsoft nem “antibloqueio”.
 */

export type PresellTypeDefinition = {
  id: string;
  /** Título curto no trigger e na tabela. */
  name: string;
  /** Subtítulo no menu (o que a página pública faz de facto). */
  description: string;
};

export type PresellTypeGroup = {
  id: string;
  label: string;
  hint?: string;
  types: PresellTypeDefinition[];
};

export const PRESELL_TYPE_GROUPS: PresellTypeGroup[] = [
  {
    id: "gate-cookies",
    label: "Entrada e consentimento",
    hint: "Camadas claras de privacidade e consentimento — reforçam transparência antes da oferta.",
    types: [
      {
        id: "cookies",
        name: "Cookies (consentimento)",
        description:
          "Modal profissional de cookies e privacidade. Fluxo explícito para o visitante; ideal quando a campanha exige consentimento visível.",
      },
      {
        id: "fantasma",
        name: "Fantasma (redirect no 1.º gesto)",
        description:
          "Redireciona no primeiro movimento. Risco elevado nas políticas de destino (bridge/cloaking). Use só com revisão humana e redes que o permitam — não é “antibloqueio”.",
      },
    ],
  },
  {
    id: "pagina-oferta",
    label: "Página de oferta (editorial)",
    hint: "Layouts distintos com valor próprio, divulgação de afiliado e CTA rastreado. Orientados a políticas de conteúdo original.",
    types: [
      {
        id: "tsl",
        name: "TSL — Text Sales Letter",
        description:
          "Carta de vendas editorial: leitura longa, contexto e decisão consciente. Com espelho: clone + chrome TSL. Sem espelho: tipografia e blocos profissionais.",
      },
      {
        id: "dtc",
        name: "DTC — Direct to Consumer",
        description:
          "Vitrine directa e limpa: produto, proposta e passo no site do vendedor. Ideal para conversão com transparência (não se apresenta como fabricante).",
      },
      {
        id: "review",
        name: "Review / análise",
        description:
          "Análise independente. Todos os botões e CTAs levam o hoplink rastreado. Rodapé só no nível legal (políticas + aviso), sem chrome da rede.",
      },
      {
        id: "desconto",
        name: "Desconto + urgência",
        description:
          "Faixa e modal de promoção. Só usa descontos escritos na origem — sem inventar preços. Confirmação final no vendedor.",
      },
    ],
  },
  {
    id: "video",
    label: "Vídeo de vendas (VSL)",
    hint: "Hero escuro cinematográfico; vídeo + transparência. Sem claims médicos inventados.",
    types: [
      {
        id: "vsl",
        name: "VSL — foco no vídeo",
        description:
          "Composição escura centrada no vídeo. Sem carta longa abaixo. Visitante vê, decide e confirma no destino.",
      },
      {
        id: "vsl_tsl",
        name: "VSL + TSL (combo)",
        description:
          "Vídeo no topo + carta editorial abaixo. Duas camadas de valor próprio antes do checkout do comerciante.",
      },
    ],
  },
  {
    id: "gates-form",
    label: "Qualificação (antes do CTA)",
    hint: "Gates limpos e profissionais: só pedem o necessário. Depois o visitante segue para a oferta no vendedor.",
    types: [
      {
        id: "sexo",
        name: "Sexo",
        description: "Qualificação demográfica curta antes do CTA — útil para anúncios sensíveis a perfil.",
      },
      {
        id: "idade",
        name: "Idade",
        description: "Confirmação de idade mínima configurável. CTA só após resposta válida.",
      },
      {
        id: "idade_sexo",
        name: "Idade + sexo",
        description: "Dois passos de qualificação quando a rede ou a oferta exige ambos.",
      },
      {
        id: "idade_pais",
        name: "Idade + país",
        description: "Idade e país antes do destino — alinhado a envio, elegibilidade ou geo.",
      },
      {
        id: "sexo_pais",
        name: "Sexo + país",
        description: "Perfil e localização antes do link da oferta.",
      },
      {
        id: "grupo_homem",
        name: "Grupo etário — homem",
        description: "Faixas etárias para público masculino, apresentação clara antes do redirect.",
      },
      {
        id: "grupo_mulher",
        name: "Grupo etário — mulher",
        description: "Faixas etárias para público feminino, apresentação clara antes do redirect.",
      },
      {
        id: "pais",
        name: "País",
        description: "Escolha de país com UI limpa — moeda, envio ou mensagem geo-específica.",
      },
      {
        id: "captcha",
        name: "Captcha",
        description: "Verificação humana discreta para reduzir cliques inválidos sem parecer phishing.",
      },
      {
        id: "modelos",
        name: "Modelos (curadoria)",
        description: "Escolha de apresentação/variante antes do destino — útil em ofertas com várias faces.",
      },
    ],
  },
];

/** Lista plana (validações, defaults). */
export const PRESELL_TYPE_OPTIONS: PresellTypeDefinition[] = PRESELL_TYPE_GROUPS.flatMap((g) => g.types);

export function getPresellTypeOption(id: string): PresellTypeDefinition | undefined {
  return PRESELL_TYPE_OPTIONS.find((t) => t.id === id);
}

export function getPresellTypeLabel(type: string): string {
  if (type === "builder") return "Manual (editor)";
  return getPresellTypeOption(type)?.name ?? type;
}

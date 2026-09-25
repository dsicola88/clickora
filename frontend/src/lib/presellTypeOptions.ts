/**
 * Opções de «Tipo de presell» no assistente — alinhadas ao comportamento real em `PublicPresell` / `presellTypeMeta`.
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
    hint: "Camada antes do visitante ver a oferta — útil para fluxos tipo anunciante e requisitos de consentimento.",
    types: [
      {
        id: "cookies",
        name: "Cookies (consentimento)",
        description:
          "Modal de política de cookies no centro do ecrã. «Permitir» ou fechar segue para o teu link de afiliado; podes indicar URL opcional da política. Comportamento equivalente ao «modelo cookie» de ferramentas de presell.",
      },
      {
        id: "fantasma",
        name: "Fantasma (redirect no primeiro gesto)",
        description:
          "A página carrega e, no primeiro movimento do rato, toque ou scroll, redireciona de imediato para a oferta. Interação mínima; usa só onde as regras da rede e a tua compliance o permitirem.",
      },
    ],
  },
  {
    id: "pagina-oferta",
    label: "Página de oferta (conteúdo importado)",
    hint: "Layout claro com texto e imagens vindos do URL do produto; CTAs rastreados pela Clickora.",
    types: [
      {
        id: "tsl",
        name: "TSL — Text Sales Letter",
        description:
          "Com espelho 1:1 activo: clone da sales page + barra TSL e CTA rastreado. Sem espelho: carta de vendas em texto (blocos importados, imagens, CTAs). Sem vídeo obrigatório no topo.",
      },
      {
        id: "dtc",
        name: "DTC — Direct to Consumer",
        description:
          "Com espelho 1:1: clone + chrome DTC (decisão rápida). Sem espelho: hero compacto tipo vitrine com cópia persuasiva. Ideal para ofertas de conversão directa.",
      },
      {
        id: "review",
        name: "Review / análise",
        description:
          "Com espelho 1:1: clone + selo Review e rating quando existir. Sem espelho: layout de análise/crítica da oferta antes do checkout.",
      },
      {
        id: "desconto",
        name: "Desconto + urgência",
        description:
          "Faixa de urgência com contagem, modal de desconto e prova social sobre o conteúdo. Percentuais e mensagens alinham ao que foi possível extrair da página do produto no import.",
      },
    ],
  },
  {
    id: "video",
    label: "Vídeo de vendas (VSL)",
    hint: "Topo escuro focado em vídeo; o vídeo é detetado no import quando o HTML o expõe, ou podes colar URL (ex. YouTube) abaixo.",
    types: [
      {
        id: "vsl",
        name: "VSL — só vídeo (sem carta longa em baixo)",
        description:
          "Com espelho 1:1: clone + barra VSL com leitor de vídeo (se houver URL). Sem espelho: layout escuro VSL; a carta longa não se repete abaixo. Foco: ver e clicar.",
      },
      {
        id: "vsl_tsl",
        name: "VSL + TSL (combo)",
        description:
          "Com espelho 1:1: clone + chrome VSL+TSL e vídeo no topo se disponível. Sem espelho: hero vídeo + carta completa abaixo.",
      },
    ],
  },
  {
    id: "gates-form",
    label: "Qualificação (formulário antes do CTA)",
    hint: "O botão principal para a oferta só fica ativo depois de o visitante preencher o campo pedido.",
    types: [
      {
        id: "sexo",
        name: "Sexo",
        description:
          "Pergunta de sexo antes de liberar o CTA. Segmenta a experiência ou cumpre requisitos de anúncios sensíveis a demografia.",
      },
      {
        id: "idade",
        name: "Idade",
        description:
          "O visitante indica a idade; podes definir idade mínima nas opções. CTA desativado até a resposta ser válida.",
      },
      {
        id: "idade_sexo",
        name: "Idade + sexo",
        description:
          "Idade (mínima configurável) e sexo antes de liberar o CTA — comum quando a rede ou a oferta exige os dois.",
      },
      {
        id: "idade_pais",
        name: "Idade + país",
        description:
          "Idade mínima e país antes do link da oferta; útil para envio, moeda ou mensagem geo-específica.",
      },
      {
        id: "sexo_pais",
        name: "Sexo + país",
        description: "Sexo e país antes do CTA.",
      },
      {
        id: "grupo_homem",
        name: "Grupo etário — homem",
        description:
          "Seleção de faixa etária para público masculino antes do redirect para a oferta.",
      },
      {
        id: "grupo_mulher",
        name: "Grupo etário — mulher",
        description:
          "Seleção de faixa etária para público feminino antes do redirect para a oferta.",
      },
      {
        id: "pais",
        name: "País",
        description:
          "Escolha de país antes do CTA. Útil para ofertas com envio, moeda ou mensagem geo-específica.",
      },
      {
        id: "captcha",
        name: "Captcha",
        description:
          "Pequeno desafio anti-bot antes de ativar o link da oferta; reduz cliques inválidos em campanhas expostas a tráfego de baixa qualidade.",
      },
      {
        id: "modelos",
        name: "Modelos (curadoria)",
        description:
          "Gate com escolha de «modelos» ou variantes apresentadas antes de seguir para o destino — comum em ofertas com várias apresentações visuais.",
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

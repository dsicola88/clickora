/**
 * Checklist antes de escalar — linguagem para afiliado / media buyer.
 */

export type MediaBuyerE2eStep = {
  id: string;
  label: string;
  detail: string;
  href?: string;
};

export const MEDIA_BUYER_E2E_CHECKLIST: MediaBuyerE2eStep[] = [
  {
    id: "publish",
    label: "1. Página publicada com link da oferta",
    detail: "O link público abre a página e o botão leva à rede de afiliados.",
  },
  {
    id: "pixels",
    label: "2. Pixels das redes (Meta, TikTok, Google, Bing)",
    detail: "Colados na página; confirma com 1 visita de teste no depurador da rede.",
  },
  {
    id: "postback",
    label: "3. Aviso de venda da rede",
    detail: "URL de aviso de venda colado no painel MaxWeb, BuyGoods, etc.",
    href: "/integracoes/postback",
  },
  {
    id: "smoke",
    label: "4. Teste pequeno com anúncio pago",
    detail: "Budget baixo → 1 clique → Relatórios com Situação Real → 1 venda registada.",
    href: "/resultados/relatorios/cliques",
  },
  {
    id: "funnel",
    label: "5. Funil e lucro",
    detail: "Em Funil: visitas → cliques → checkout → vendas; Pago vs Sem ID vs Orgânico; lucro só com custo do período.",
    href: "/resultados/funil",
  },
  {
    id: "rotators",
    label: "6. Testes A/B (rotadores)",
    detail: "Compara variantes com custo e retorno do período antes de escolher a vencedora.",
    href: "/resultados",
  },
  {
    id: "ivt",
    label: "7. IPs de servidor no Google Ads",
    detail: "Em Relatórios → Cliques, copia IPs Cloud para exclusões de IP no Google Ads.",
    href: "/resultados/relatorios/cliques",
  },
  {
    id: "ads_upload",
    label: "8. Envios às redes e custos actualizados",
    detail:
      "Em Integrações / Relatórios: sem falhas de envio, vendas sem ID do clique revistas, custos actualizados nas últimas 48h.",
    href: "/integracoes",
  },
];

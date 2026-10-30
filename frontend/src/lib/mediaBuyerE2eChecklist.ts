/**
 * Checklist E2E para media buyer — passos verificáveis antes de escalar.
 * Só texto/orientação; não inventa estado de campanhas externas.
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
    label: "1. Presell publicada com hoplink",
    detail: "URL /p/… ou domínio próprio abre a página e o CTA aponta para a rede.",
  },
  {
    id: "pixels",
    label: "2. Pixels (Meta / TikTok / Google / Bing)",
    detail: "IDs ou script colado; validar no depurador da plataforma após 1 visita de teste.",
  },
  {
    id: "postback",
    label: "3. Postback da rede",
    detail: "URL de postback com {SUBID}/click id colado no painel MaxWeb/BuyGoods/etc.",
    href: "/integracoes/postback",
  },
  {
    id: "smoke",
    label: "4. Smoke test pago pequeno",
    detail: "1 anúncio com budget baixo → clique → Situação Real em Relatórios → 1 conversão/postback.",
    href: "/resultados/relatorios/cliques",
  },
  {
    id: "funnel",
    label: "5. Funil + ROI",
    detail: "Em Funil: impressão → clique → checkout → venda; split Pago / Ads sem ID / Orgânico; lucro só com custo do período.",
    href: "/resultados/funil",
  },
  {
    id: "rotators",
    label: "6. A/B rotadores + ROI",
    detail: "Em Resultados → Rotadores / Destinos: comparar braços com custo e retorno do período antes de promover o vencedor.",
    href: "/resultados",
  },
  {
    id: "ivt",
    label: "7. Cloud / IVT no Google Ads",
    detail: "Em Relatórios → Cliques, copiar IPs Datacenter para exclusões de IP; pedir crédito IVT se aplicável.",
    href: "/resultados/relatorios/cliques",
  },
  {
    id: "ads_upload",
    label: "8. Envios Ads + custos frescos",
    detail:
      "Em Integrações / Relatórios: zero falhas Google·Meta·TikTok, vendas sem gclid/fbclid/ttclid revistas, custos sync ≤48h.",
    href: "/integracoes",
  },
];

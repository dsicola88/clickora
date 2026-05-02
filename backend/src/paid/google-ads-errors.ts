/**
 * Mensagens da API Google Ads (REST) → texto útil para o utilizador (PT).
 */
export function humanizeGoogleAdsPublishError(raw: string): string {
  const m = raw.trim();

  if (/POLICY_FINDING|PROHIBITED|TopicConstraintType:\s*PROHIBITED|policy topic/i.test(m)) {
    return (
      "O Google Ads recusou o anúncio ou a página final por política de conteúdo (ex.: sector ou tema marcado como PROHIBITED). " +
      "Isto vem da validação da rede, não da Clickora: abre o rascunho no Google Ads, vê o motivo em qualidade/políticas do anúncio, ajusta textos, keywords ou URL e volta a tentar. " +
      "Se a campanha remota ficou incompleta, apaga ou corrige esse rascunho no Google antes de republicar."
    );
  }

  if (/not compatible with the campaign type|setting type is not compatible/i.test(m)) {
    return "O Google Ads recusou uma opção típica de segmentação (geografia) quando não combina com o tipo Search. A publicação volta a usar definições validadas pela API — tente de novo «Aplicar na rede». Se repetir, contacte o suporte com esta mensagem.";
  }

  if (/invalid argument/i.test(m)) {
    const clip = m.length > 900 ? `${m.slice(0, 900)}…` : m;
    return `${clip}\n\nSe a mensagem mencionar política ou PROHIBITED, corrige o criativo ou a landing no Google Ads. Caso contrário, copie o texto acima para o suporte Clickora com a referência do pedido.`;
  }

  return m;
}

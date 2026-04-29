/**
 * Mensagens da API Google Ads (REST) → texto útil para o utilizador (PT).
 */
export function humanizeGoogleAdsPublishError(raw: string): string {
  const m = raw.trim();

  if (/not compatible with the campaign type|setting type is not compatible/i.test(m)) {
    return "O Google Ads recusou uma opção típica de segmentação (geografia) quando não combina com o tipo Search. A publicação volta a usar definições validadas pela API — tente de novo «Aplicar na rede». Se repetir, contacte o suporte com esta mensagem.";
  }

  if (/invalid argument/i.test(m) && m.length < 280) {
    return `${m}\n\nSe precisar de ajuda humana: copie esta mensagem e a referência do pedido (card abaixo) para o suporte Clickora.`;
  }

  return m;
}

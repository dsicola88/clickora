# Afiliado profissional — o que a dclickora cobre

## Resposta honesta

Para um afiliado que opera **Google Ads + BuyGoods / Digistore / SmartAdv** (presell → hoplink → postback → offline Google): **sim — a app cobre o funil completo** se configurar tracking + OAuth Google + postback com `order_id`.

Não é um clone de Voluum (sem Automizer/Binom rules). É um hub de atribuição + P&L + presell pensado para esse fluxo.

## Checklist (compra com confiança)

1. URL com tracking da app no anúncio (`utm_term={keyword}`, GCLID automático)
2. Postback com UUID (`{SUBID}` / `{cid}` / `{sub3}`) **e** `orderid`
3. Google Ads OAuth ligado (custo + upload de conversões + retraction em refund)
4. Domínio próprio (Pro Mensal: 1 · Pro Anual: até 2)
5. R2 configurado em produção (imagens não somem no redeploy)

## Capacidades

| Necessidade | Estado |
|-------------|--------|
| Presell + domínio | Sim |
| Clique → UUID no hoplink | Sim |
| Postback → venda + **rebill** (vários order_id / clique) | Sim |
| **Refund** reverte receita + Google RETRACTION | Sim |
| Upload conversões Google Ads | Sim |
| Meta CAPI / TikTok Events | Sim |
| Receita honesta (só postbacks aprovados) | Sim |
| ROAS conta (gasto Google do período) | Sim |
| **Keyword P&L** (utm_term × receita × custo Google) | Sim |
| Lucro por campanha | Sim |
| Soft-cap de cliques (ads **nunca** 429) | Sim |
| Rotador A/B / geo | Sim |

## O que ainda não é Voluum

- Regras Automizer / pause automático de keywords
- Cost sync persistido por dia em tabela (hoje: live GAQL no dashboard)
- 50+ templates de rede pré-mapeados (temos BuyGoods, Digistore, SmartAdv + genérico)

## Deploy

Após pull: correr migration `20260924230000_conversion_multi_per_click` e garantir `R2_*` no Railway.

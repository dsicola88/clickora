# Afiliado profissional — nível operacional

## Resposta honesta

Para **Google Ads + BuyGoods / Digistore / SmartAdv**, a dclickora cobre o funil de um media buyer sério: atribuição, P&L histórico, refunds, pending→aprovado, Automizer de keywords e anti-fraude básico.

Não é Voluum enterprise (sem Automizer multi-tráfego global). É o stack certo para quem escala Search + redes de postback.

## Checklist

1. URL tracking no anúncio (`utm_term={keyword}`, `utm_content={adgroupid}` ou nome do grupo)
2. Postback com UUID + `orderid` + `transaction_type` (refunds)
3. Google Ads OAuth
4. Integrações → **Automizer & custos** (dry-run → depois real)
5. Railway **always-on** + `PUBLIC_API_URL` / `KEEP_ALIVE_URL` para self-ping
6. Migration `20260924233000_pro_cost_automizer_fraud` + R2 em produção

## Capacidades

| Necessidade | Estado |
|-------------|--------|
| Custo diário persistido (Google/Meta/TikTok) | Sim |
| Keyword P&L + Ad group P&L | Sim |
| Automizer pause keyword (dry-run / real) | Sim |
| Soft-cap cliques (nunca 429) | Sim |
| Refund → RETRACTION Google | Sim |
| Ajuste valor → RESTATEMENT | Sim |
| Pending → aprovado | Sim |
| Anti-bot + proxy/VPN score | Sim |
| Keep-alive / cold-start mitigation | Sim |
| ROAS multi-plataforma (gasto sync) | Sim |

## Env recomendado (Railway)

```
PUBLIC_API_URL=https://sua-api.up.railway.app
KEEP_ALIVE_URL=https://sua-api.up.railway.app
AFFILIATE_COST_SYNC_CRON=15 * * * *
AFFILIATE_AUTOMIZER_CRON=*/20 * * * *
R2_* = completo
```

No painel Railway: desactivar sleep / usar instância sempre ligada.

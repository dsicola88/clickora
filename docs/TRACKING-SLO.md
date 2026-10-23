# Tracking SLOs (dclickora)

Objectivos de serviço para o click path profissional (paridade Voluum no que importa ao buyer).

## Metas

| Métrica | Alvo | Notas |
|---------|------|--------|
| Disponibilidade `/api/health` | ≥ 99.5% / mês | Railway always-on + `KEEP_ALIVE_URL` |
| Latência p95 `GET /api/track/r/:id` | &lt; 400 ms (EU) | Medir no edge do afiliado; hop Vercel conta |
| Atribuição pós-venda (postback correcto) | ≥ 95% attributed | Macros `{SUBID2}` / `{sid1}` |
| Detecção incidente 5xx | &lt; 15 min | `OPS_ALERT_WEBHOOK_URL` + Sentry |

## Click path recomendado

1. **Produção (domínio do afiliado):** same-origin `/api/track/r/…` (rewrite Vercel → Railway). IP via `X-Vercel-Forwarded-For`.
2. **Override:** `VITE_PUBLIC_TRACK_API_URL=https://<railway>/api` se o proxy Vercel adicionar latência ou falhar.
3. **Keep-alive:** `KEEP_ALIVE_URL` / `PUBLIC_API_URL` no backend para evitar cold start.

## Verificação rápida

- UI: Integrações → cartão «Click path» (ping + p50/p95 amostrado em `ops.track_redirect`).
- Health JSON: `GET /api/health` → `ops.track_redirect.p95_ms` e `ops.errors_5xx_window_5m`.
- CLI: `curl -sI -o /dev/null -w '%{time_total}\n' 'https://…/api/health'`
- Gate: `npm run test:dual-pillar-gate` (backend) + CI `.github/workflows/dual-pillar-gate.yml`
- E2E: `E2E_LIVE=1 node --import tsx scripts/e2e-affiliate-clickid-resilience.ts`

## Alertas

- `OPS_ALERT_WEBHOOK_URL`: burst 5xx (≥ `OPS_5XX_BURST_THRESHOLD`, default 5 / 5 min) e vendas unattributed (cooldown por tipo).
- `KEEP_ALIVE_URL`: evita cold start Railway.

## Fora de scope (por agora)

CDN edge global tipo Voluum; multi-região activa-activa.

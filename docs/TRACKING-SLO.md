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
2. **Domínio de tracking first-class:** em Configurações → Domínios, escolha finalidade **Só tracking** (ex. `go.marca.com`) e **Padrão tracking**. A lander fica em `www` (hosting/both). Pixel e redirects preferem o host de tracking; a raiz de `go` não abre presell. Domínios `tracking` **não** entram no seletor de lander nem em `custom_domain_id` / `is_default` lander.
3. **Override:** `VITE_PUBLIC_TRACK_API_URL=https://<railway>/api` se o proxy Vercel adicionar latência ou falhar.
4. **Keep-alive:** `KEEP_ALIVE_URL` / `PUBLIC_API_URL` no backend para evitar cold start.
5. **Rate limit:** IP limitado **antes** do lookup da página (`Retry-After` + Redis Lua atómico quando `REDIS_URL` está definido).

## Verificação rápida

- UI: Integrações → cartão «Click path» (ping + p50/p95 amostrado em `ops.track_redirect`).
- Health JSON: `GET /api/health` → `ops.track_redirect.p95_ms` e `ops.errors_5xx_window_5m`.
- CLI: `curl -sI -o /dev/null -w '%{time_total}\n' 'https://…/api/health'`
- Gate: `npm run test:dual-pillar-gate` (backend) + CI `.github/workflows/dual-pillar-gate.yml`
- E2E: `E2E_LIVE=1 node --import tsx scripts/e2e-affiliate-clickid-resilience.ts`

## Alertas

- `OPS_ALERT_WEBHOOK_URL`: burst 5xx (≥ `OPS_5XX_BURST_THRESHOLD`, default 5 / 5 min) e vendas unattributed (cooldown por tipo).
- `KEEP_ALIVE_URL`: evita cold start Railway.

## Reporting multi-fonte (Resultados)

- `entry_clicks` = hops raiz (`parent_rotator_click_id` nulo); `total_hops` = todos os cliques do período.
- Dimensão **Rotadores** + **Destinos / limites** (braços) com atribuição via click ID ou filhos.
- `spend_by_platform` no KPI de custo quando o sync persiste gasto por rede.

## Fora de scope (por agora)

CDN PoP global multi-região activa-activa (Cloudflare/CDN77 *em frente* do `/api/track`).

**Decisão comercial:** o path same-origin Vercel→Railway + domínio de tracking + rate-limit early + keep-alive cobre o buyer Search. PoP global fica no roadmap 6–12 meses, não no pitch actual.

**Amostras p50/p95:** in-process por réplica Railway (reinício zera o contador). O click path continua correcto; só a amostra de latência no cartão UI é que recomeça.

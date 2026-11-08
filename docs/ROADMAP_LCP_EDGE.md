# Roadmap: LCP + tracking edge (sem billing portável)

**Data:** 2026-11-08  
**Excluído:** billing portável (Stripe/outro gateway) — pedido explícito.

## Objectivo

Melhorias de fundação:

1. **LCP** — landers Ads via HTML estático cacheável (`/l/:uuid`) em vez de SPA completa.
2. **Tracking edge** — redirect de oferta com cache de destino + worker Cloudflare opcional.

## Fases

| Fase | Entrega | Done when |
|------|---------|-----------|
| 0 | Este doc + canvas | Escopo fechado | **Feito** |
| 1 | `GET /api/public/presells/id/:id/html` + rewrite `/l/:id` + URL Ads prefer lite | HTML cacheável; CTA → track | **Feito no código** |
| 2 | Cache destino + `GET /api/track/edge/dest/:id` | Hit de cache no origin | **Feito no código** |
| 3 | `edge/track-worker` | Worker no repo; deploy = ops | **Feito no repo** |
| 4 | CNAME tracking → Worker | Smoke prod (ops) | **Ops (fora do código)** |

## Fora de âmbito

- Billing portável
- Substituir `/p/:id` SPA (gates, builder, preview)

## Aceite

- Tipos com gate interativo **não** usam `/l/` por defeito.
- SPA `/p/` intacta.
- Testes unitários verdes.

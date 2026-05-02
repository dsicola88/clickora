# Dpilot (Paid Ads) — onde está

O Dpilot existe apenas no monólito Clickora. Não há app separada nem iframe.

| Camada | Local |
|--------|-------|
| UI | `frontend/src/pages/dpilot/*` — rotas `/tracking/dpilot/*` |
| API | `backend/src/paid/*` — prefixo `/api/paid/*` e OAuth em `/api/paid/oauth/*/callback` |
| Dados | tabelas `paid_ads_*` em `backend/prisma/schema.prisma` |

Arquitectura, tenant e env vars: [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md).
Roadmap de produto: [PAID-AUTOPILOT-PRODUCT-ROADMAP.md](./PAID-AUTOPILOT-PRODUCT-ROADMAP.md).

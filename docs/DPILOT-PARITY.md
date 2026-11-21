# Dpilot (Paid Ads) — onde está

O Dpilot existe apenas no monólito Clickora. Não há app separada nem iframe.

| Camada | Local |
|--------|-------|
| UI | `frontend/src/pages/dpilot/*` — rotas `/tracking/dpilot/*` |
| API | `backend/src/paid/*` — prefixo `/api/paid/*` e OAuth em `/api/paid/oauth/*/callback` |
| Dados | tabelas `paid_ads_*` em `backend/prisma/schema.prisma` |

Arquitectura, tenant e env vars: [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md).
Roadmap de produto: [PAID-AUTOPILOT-PRODUCT-ROADMAP.md](./PAID-AUTOPILOT-PRODUCT-ROADMAP.md).

## Paridade multi-rede (2026-11-20)

| Capacidade | Google Search | Meta | TikTok |
|------------|---------------|------|--------|
| OAuth + criar campanha | Sim | Sim | Sim (campanha+ad group; vídeo parcial) |
| Campaign Manager (visão/métricas) | Sim | Sim (`/meta/*`, `meta-ads/*`) | Sim (`/tiktok/*`, `tiktok-ads/*`) |
| Pause / resume / budget | Sim | Sim (`meta-studio-actions`) | Sim (`tiktok-studio-actions`) |
| Import remoto | Sim (Search) | Sim | Sim |
| Inventário local | Sim | Sim (adsets/criativos) | Sim (IDs ad group/ad) |
| Anexar anúncio pós-publish | RSA studio | meta_publish_creative | `tiktok_publish_creative` / «Anexar anúncio» |
| Search terms / Final URL repair | Sim | N/A | N/A |
| Hub «Todas as campanhas» toggle | Sim | Sim | Sim |
| Cockpit prontidão multi-rede | `GET …/networks-readiness` + card Visão | idem | idem |
| Autopilot (pause/scale/realloc/flag) | Sim | Sim | Sim (dry-run default) |

Google Search continua o gestor mais profundo (termos/RSA); Meta/TikTok têm ops day-to-day + criativo TikTok anexável sem tocar `/google/*`.

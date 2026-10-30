# Arquitetura DClickora

**Data do mapa:** 2026-10-30  
**Fonte:** código em `frontend/`, `backend/`, `backend/prisma/schema.prisma` — não inventado.

## 1. Visão geral

Monólito comercial com dois processos:

| Camada | Stack | Deploy típico |
|--------|--------|----------------|
| Web | React 18 + Vite + TypeScript | Vercel (`dclickora.com`) |
| API | Node.js + Express + Prisma | Railway |
| Dados | PostgreSQL | Railway (plugin) / Docker local `:5434` |

**Um único login JWT** serve presells, tracking, planos, workspaces e anúncios pagos (`/tracking/dpilot` + `/api/paid`).

```
Browser (Vercel)
    │  HTTPS + Bearer JWT
    ▼
Express (Railway) ── Prisma ── PostgreSQL
    │
    ├── /api/auth, /api/plans, /api/webhooks (Hotmart)
    ├── /api/presells, /api/campaigns, /api/track, /api/analytics
    ├── /api/paid (+ OAuth callbacks públicos)
    ├── /api/integrations (Google Ads / Meta CAPI / TikTok Events — afiliado)
    └── /api/admin, /api/enterprise, /api/public
```

## 2. Entrada da API

Ficheiro único: `backend/src/server.ts` (não existe `app.ts`).

Montagem (evidência ~L235–267): `/api/auth`, `/api/enterprise`, `/api/presells`, `/api/campaigns`, `/api/keyword-researches`, `/api/lessons`, `/api/analytics`, `/api/plans`, `/api/admin`, `/api/track`, `/api/webhooks`, `/api/integrations`, `/api/custom-domain`, `/api/traffic-rotators`, `/api/workspaces`, `/api/paid`, `/api/public`, depois `errorHandler`.

## 3. Identidade e tenant

| Conceito | Implementação |
|----------|----------------|
| Sessão | JWT (`userId`, `email`, `tenantUserId?`, workspace) — `backend/src/lib/jwt.ts` |
| Tenant de faturação | `tenantUserId ?? userId` (dono da conta / workspace) |
| Isolamento ALS | `tenantIsolation` → AsyncLocalStorage; cliente Prisma default injeta `userId` |
| Bypass explícito | `systemPrisma` / `prismaAdmin` (auth, track público, admin, jobs) |
| Anúncios | `systemPrisma` + filtros manuais `userId: tenantUserId` em `paid/permissions.ts` |

## 4. Módulos de produto

| Produto | UI | API | Dados |
|---------|----|-----|--------|
| Presells | `/presells`, wizard, builder | `/api/presells`, `/api/public` | `PresellPage`, compliance |
| Tracking | dashboards, relatórios, rotadores | `/api/track`, `/api/analytics` | `TrackingEvent`, `Conversion`, rotadores |
| Anúncios | `/tracking/dpilot/*` | `/api/paid/*` | `paid_ads_*` |
| Planos | `/plans` | `/api/plans`, webhook Hotmart | `Plan`, `Subscription` |
| Integrações afiliado | Hub Integrações | `/api/integrations` | tokens no `User` (encriptados com `ENCRYPTION_KEY`) |

## 5. Dpiloto legado

- **Removido:** app externa, iframe SSO, `CLICKORA_DPILOT_SSO_SECRET`.
- **Mantido (nome histórico):** rotas `/tracking/dpilot`, flag `dpilot_ads_enabled`, middleware `requireDpilotPlan`, env opcional `DPILOTO_PUBLIC_ORIGINS` (só CORS).

## 6. Dupla stack Google Ads

1. **Afiliado / conversões:** `backend/src/modules/googleAds/*` + integrações.
2. **Criação de campanhas paid:** `backend/src/paid/google-ads.*` + OAuth em `/api/paid/oauth/google`.

São produtos distintos no mesmo backend; não partilham a mesma tabela de ligação OAuth.

## 7. Decisões arquiteturais relevantes

1. Tenant por `userId` do dono (não schema-per-tenant).
2. Tracking público sem JWT; quotas e rate-limit por IP em memória.
3. Paid ads fora do cliente Prisma tenant-safe — isolamento por `assertProjectMember` / `userId` no projeto.
4. Assinatura: Hotmart (webhooks), não Stripe no fluxo Angola documentado.
5. Media: Cloudflare R2 em produção; disco local só em dev.

## 8. Diagrama de autenticação

```
Login / OIDC / MFA
    → signToken(purpose: session)
    → Authorization: Bearer
    → authenticate → (tenantIsolation) → requireActiveSubscription?
    → handler
```

Paid: `authenticate` + `requireActiveSubscription` + `requireDpilotPlan` (desde auditoria 2026-10-30).

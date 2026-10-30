# Arquitetura DClickora

**Data do mapa:** 2026-10-30 (Etapa 6)  
**Fonte:** código em `frontend/`, `backend/`, `backend/prisma/schema.prisma` — não inventado.  
**Índice:** [INDICE_DOCUMENTACAO_DCLICKORA.md](./INDICE_DOCUMENTACAO_DCLICKORA.md).

## 1. Visão geral

Monólito comercial com dois processos:

| Camada | Stack | Deploy típico |
|--------|--------|----------------|
| Web | React 18 + Vite + TypeScript | Vercel (`dclickora.com`) |
| API | Node.js + Express + Prisma | Railway |
| Dados | PostgreSQL | Railway (plugin) / Docker local `:5434` |
| Cache opcional | Redis (`REDIS_URL`) | Rate-limit de `/track` multi-réplica |

**Um único login JWT** serve presells, tracking, planos, workspaces e anúncios pagos (`/tracking/dpilot` + `/api/paid`).

```
Browser (Vercel)
    │  HTTPS + Bearer JWT
    ▼
Express (Railway) ── Prisma ── PostgreSQL
    │                 └── (opcional) Redis — track rate limit
    ├── /api/auth, /api/plans, /api/webhooks (Hotmart)
    ├── /api/presells, /api/campaigns, /api/track, /api/analytics
    ├── /api/paid (+ OAuth callbacks públicos)
    ├── /api/integrations (Google Ads / Meta CAPI / TikTok Events — afiliado)
    └── /api/admin, /api/enterprise, /api/public
```

## 2. Entrada da API

Ficheiro único: `backend/src/server.ts` (não existe `app.ts`).

No boot (produção):

1. Validação de `JWT_SECRET` (`lib/jwt.ts`)  
2. `assertProductionEncryptionKey()` — `ENCRYPTION_KEY` obrigatória  

Montagem típica: `/api/auth`, `/api/enterprise`, `/api/presells`, `/api/campaigns`, `/api/keyword-researches`, `/api/lessons`, `/api/analytics`, `/api/plans`, `/api/admin`, `/api/track`, `/api/webhooks`, `/api/integrations`, `/api/custom-domain`, `/api/traffic-rotators`, `/api/workspaces`, `/api/paid`, `/api/public`, depois `errorHandler`.

## 3. Identidade e tenant

| Conceito | Implementação |
|----------|----------------|
| Sessão | JWT (`userId`, `email`, `tenantUserId?`, workspace) — `backend/src/lib/jwt.ts` |
| Tenant de faturação | `tenantUserId ?? userId` (dono da conta / workspace) |
| Isolamento ALS | `tenantIsolation` → AsyncLocalStorage; cliente Prisma default injeta `userId` em modelos de `USER_ID_MODELS` (`lib/tenantPrisma.ts`) |
| Bypass explícito | `systemPrisma` / `prismaAdmin` (auth, track público, admin, jobs) |
| Anúncios | `systemPrisma` + filtros manuais `userId: tenantUserId` / `updateMany` com ownership (`paid/permissions.ts`, mutações) |

Detalhe de provas IDOR: [SEGURANCA_E_ISOLAMENTO.md](./SEGURANCA_E_ISOLAMENTO.md).

## 4. Módulos de produto

| Produto | UI | API | Dados |
|---------|----|-----|--------|
| Presells | `/presells`, wizard, builder | `/api/presells`, `/api/public` | `PresellPage`, compliance |
| Tracking | dashboards, relatórios, rotadores | `/api/track`, `/api/analytics` | `TrackingEvent`, `Conversion`, rotadores |
| Anúncios | `/tracking/dpilot/*` (lazy `DpilotPaidApp`) | `/api/paid/*` | `paid_ads_*` |
| Planos | `/plans` | `/api/plans`, webhook Hotmart | `Plan`, `Subscription` |
| Integrações afiliado | Hub Integrações | `/api/integrations` | tokens no `User` (encriptados com `ENCRYPTION_KEY`) |

## 5. Dpiloto legado

- **Removido:** app externa, iframe SSO, `CLICKORA_DPILOT_SSO_SECRET`.
- **Mantido (nome histórico):** rotas `/tracking/dpilot`, flag `dpilot_ads_enabled`, middleware `requireDpilotPlan`, env opcional `DPILOTO_PUBLIC_ORIGINS` (só CORS).

## 6. Dupla stack Google Ads

1. **Afiliado / conversões:** `backend/src/modules/googleAds/*` + integrações.
2. **Criação de campanhas paid:** `backend/src/paid/google-ads.*` + OAuth em `/api/paid/oauth/google`.

São produtos distintos no mesmo backend; **não** partilham a mesma tabela de ligação OAuth.

## 7. Decisões arquiteturais relevantes

1. Tenant por `userId` do dono (não schema-per-tenant).
2. Tracking público sem JWT; rate-limit por IP (memória **ou** Redis se `REDIS_URL`).
3. Paid ads fora do cliente Prisma tenant-safe automático — isolamento por ownership + `userId` nas mutações.
4. Tokens OAuth paid: `tokenSecrets` + redacção em `api-mappers`; nunca devolver refresh/access em JSON de API.
5. Saídas HTTP para destinos do utilizador: `destinationProbe` / `safeImportFetch` (SSRF — bloqueio de IPs privados + pin).
6. Assinatura: Hotmart (webhooks), não Stripe no fluxo Angola documentado.
7. Media: Cloudflare R2 em produção; disco local só em dev.
8. Frontend: Lucide via `lucide-icon.ts` (dynamic imports); Dpiloto em `React.lazy`.

## 8. Diagrama de autenticação

```
Login / OIDC / MFA
    → signToken(purpose: session)
    → Authorization: Bearer
    → authenticate → (tenantIsolation) → requireActiveSubscription?
    → [paid] requireDpilotPlan?
    → handler
```

## 9. Performance (pontos de controlo)

Ver [OTIMIZACAO_PERFORMANCE_DCLICKORA.md](./OTIMIZACAO_PERFORMANCE_DCLICKORA.md).

- Pool Prisma: `PRISMA_CONNECTION_LIMIT` / URL `connection_limit`
- CSV conversões: batch insert/update
- Índices em tracking / eventos (migrações)
- Bundle: sem chunk monolítico `icons-vendor`; Dpiloto code-split

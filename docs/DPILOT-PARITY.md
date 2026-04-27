# Paridade Paid Autopilot: `dpilotoaut/` ↔ monólito dclickora

Objectivo: documento de trabalho para alinhar a app de referência (`dpilotoaut/`) com o módulo `/tracking/dpilot/*` no `frontend/`, reutilizando a API `backend` em `/api/paid/*`.  
Arquitetura geral, tenant e envs: [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md).

### Integração monolítica: o que pediste vs o que o código permite

A ideia é: **mesma UX e mesmas funções** que o `dpilotoaut/`, com o utilizador a entrar em **Anúncios** no dclickora e a ter o mesmo fluxo, **sem** app separada nem iframe — **só** o monólito.

**A pasta `dpilotoaut/` já está neste repositório** como código de referência. Não falta “copiar outro zip”; falta **integrar** esse código no *stack* do dclickora.

**Porque não dá para copiar/colar `frontend/` + `backend/` do dpilotoaut para cima do dclickora e “ajustar um bocadinho”:**

| dpilotoaut | dclickora (monólito) |
|------------|----------------------|
| **TanStack Start** (rotas em ficheiros, `useServerFn`, bundle Nitro `frontend/.output`) | **Vite + React Router** + `Express` num único `server.ts` |
| Lógica em `frontend/src/server/*.functions.ts` (server functions do framework) | Lógica equivalente tem de viver em **`backend/src/paid/*`** com `POST`/`GET` estáveis |
| Prisma em `dpilotoaut/backend/prisma` (schema próprio) | **Um** `schema.prisma` no Clickora; tabelas `paid_ads_*` já mapeadas para o tenant do dono |
| Sessão / org do protótipo | JWT + workspace do Clickora (já documentado) |

Ou seja: **a UX e as funções podem ser as mesmas**, mas o código tem de ser **portado** (ecrã a ecrã, função a função), não colado. Copiar pastas inteiras **quebra o build** até trocar router, imports e chamadas de rede.

**Estratégia alinhada ao teu objectivo (sem alterar o desenho da UX do dpilotoaut):**

1. **Backend:** para cada `*.functions.ts` do dpilotoaut usado em Paid, expor no `paidController` + `paid.routes.ts` o mesmo contrato (input/output), reutilizando a lógica já existente em `meta-ads.*`, `google-ads.*`, `change-request-apply`, etc.
2. **Frontend:** copiar **conteúdo** dos ecrãs (JSX, estilos, componentes partilhados) de `dpilotoaut/frontend/src/routes/*` e `components/*` para `frontend/src/pages/dpilot/` (ou subpastas), trocando `createFileRoute` / `useServerFn` por `Route` do React Router + `apiClient` / `paidAdsService`.
3. **Ordem sugerida:** wizard Meta → wizard Google → landings de projecto → o resto que ainda falte.

Isto devolve **funcionalidade e UX iguais** ao dpilotoaut **dentro** do dclickora, sem duplicar servidor nem base de dados.

## Legenda

| Estado | Significado |
|--------|-------------|
| Feito | Comportamento ou UI equivalente no monólito |
| Parcial | Existe no monólito; falta feature ou fidelidade |
| Pendente | Ainda a portar (referência abaixo) |

## 1. Rotas e ficheiros (mapa)

### Shell e autenticação

| Área | dpilotoaut | Monólito dclickora | Estado |
|------|------------|-------------------|--------|
| App com sessão | `frontend/src/routes/app.tsx` | `App.tsx` + `ProtectedRoute` | Feito |
| Paid no projecto | `app.projects.$projectId.paid*.tsx` | `pages/dpilot/DpilotPaidApp.tsx` + `DpilotPaidLayout.tsx` | Parcial (sem wizards) |

### OAuth (anúncios)

| Plataforma | dpilotoaut (hooks) | Monólito | Estado |
|------------|-------------------|----------|--------|
| Google Ads | `hooks.google-oauth.start/callback.ts` | `backend/src/paid/oauth.controller.ts` + `DpilotPaidOauthGrid.tsx` | Feito |
| Meta | `hooks.meta-oauth.*` | idem | Feito |
| TikTok | `hooks.tiktok-oauth.*` | idem | Feito |

### Visão geral, campanhas, aprovações, auditoria

| Funcional | dpilotoaut | Monólito | Estado |
|----------|------------|----------|--------|
| Overview pago / métricas | `app.projects.$projectId.paid.index.tsx` | `DpilotVisaoPage` + `paidController.getOverview` | Parcial (métricas) |
| Lista campanhas | `...paid.campaigns.index.tsx` | `DpilotCampanhasPage` + `listCampaigns` | Parcial |
| Campanhas Meta / TikTok | `...paid.meta.campaigns.tsx`, `...tiktok.campaigns.tsx` | `DpilotMetaCampanhasPage`, `DpilotTiktokCampanhasPage` | Parcial |
| Aprovações | `...paid.approvals.tsx` | `DpilotAprovacoesPage` + `change-requests` | Parcial |
| Auditoria / AI | `...paid.audit.tsx` (se existir) | `DpilotAuditoriaPage` + `ai-runs` | Parcial |

### Wizards (criação assistida)

| Fluxo | dpilotoaut (UI + server) | Monólito | Estado |
|-------|-------------------------|----------|--------|
| Nova campanha **Meta** | `app.projects.$projectId.paid.meta.wizard.tsx` — `generateMetaCampaignPlan` | Rota `…/meta/nova` + `DpilotMetaWizardPage` → `POST /api/paid/projects/:id/meta-campaign-plan` (`meta-campaign-plan.ts`) | Feito (upload remoto de asset ainda não — pré-visualização local) |
| Nova campanha **Google** | `app.projects.$projectId.paid.campaigns.new.tsx` — `generateCampaignPlan` | Rota `…/campanhas/nova` + `DpilotGoogleWizardPage` → `POST /api/paid/projects/:id/google-campaign-plan` | Feito |

Ficheiros de referência de backend no protótipo (não presentes 1:1 no monólito): `dpilotoaut/backend` / `.../server/*.functions` conforme imports nas rotas acima.

### Landings e público

| Funcional | dpilotoaut | Monólito | Estado |
|----------|------------|----------|--------|
| Landings por projecto + editor | `app.projects.$projectId.landings.*`, `landing/dpa-build-reference` | `DpilotLandingsPage` → liga a Presell no mesmo app; builder em `PageEditor` noutro módulo | Parcial (schema/builder 1:1 não portado) |
| Landing pública `/l/:slug` | `l.$slug.tsx`, `PublicLandingBySlug` | Presells/rotas públicas existentes no dclickora (não necessariamente mesmo schema) | Parcial |

### Organização e equipa

| Funcional | dpilotoaut | Monólito | Estado |
|----------|------------|----------|--------|
| Membros / convites de org | `app.projects.$projectId.organization.members.tsx` | `DpilotEquipaPage` + modelo workspace em [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md) | Parcial (UX convites) |

## 2. API `backend` hoje (âmbito)

Rotas em `backend/src/routes/paid.routes.ts` cobrem OAuth, projectos, overview, campanhas (leitura), change-requests, ligações, overviews meta/tiktok, `paid-mode`, `guardrails`, `ai-runs`. **Não** há, nesta camada, POST dedicado ao mesmo contrato que os server functions `generateMetaCampaignPlan` / `generateCampaignPlan` do `dpilotoaut` — a paridade de assistentes passa por definir DTOs e expor `POST` estáveis, ou por importar a lógica do pacote de referência de forma partilhada.

## 3. Próximas prioridades sugeridas

1. **Meta wizard:** expor no monólito o equivalente a `generateMetaCampaignPlan` + anexar criativos, repicando regras de `meta-ads.publish` e `change-request-apply`.
2. **Google wizard:** idem com `google-ads.publish` e plano RSA/campanha.
3. **Landings:** se for obrigatório o mesmo JSON do `dpa-build-reference`, planear migração de schema ou adaptador; caso contrário, manter o redirect para Presell e documentar a decisão.
4. **Equipa:** alinhar convites de workspace com a experiência de `organization.members` (apenas se produto o exigir).

Este ficheiro deve ser actualizado em cada entrega de paridade (uma linha de tabela de cada vez, se possível).

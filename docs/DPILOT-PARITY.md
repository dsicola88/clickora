# Paridade Paid Autopilot: `dpilotoaut/` ↔ monólito dclickora

Objectivo: documento de trabalho para alinhar a app de referência (`dpilotoaut/`) com o módulo `/tracking/dpilot/*` no `frontend/`, reutilizando a API `backend` em `/api/paid/*`.  
Arquitetura geral, tenant e envs: [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md).

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
| Nova campanha **Meta** | `app.projects.$projectId.paid.meta.wizard.tsx` — `generateMetaCampaignPlan`, upload assets | Rota `…/meta/nova` + `DpilotMetaNovaPage` (assistente: CTAs e doc; form real quando API) | Parcial (UI; integração API pendente) |
| Nova campanha **Google** | `app.projects.$projectId.paid.campaigns.new.tsx` — `generateCampaignPlan` | Rota `…/campanhas/nova` + `DpilotGoogleNovaPage` | Parcial (id.) |

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

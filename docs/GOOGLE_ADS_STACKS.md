# Google Ads — duas stacks (não unificar sem desenho)

**Objectivo:** evitar editar a pasta errada. São produtos distintos no mesmo backend.

| Stack | Pasta | Para quê | OAuth / tokens |
|-------|--------|----------|----------------|
| **Afiliado / conversões** | `backend/src/modules/googleAds/` | Upload de conversões, métricas de conta, insights ligados a tracking | Integrações do utilizador (`/api/integrations`, campos no `User`) |
| **Paid Autopilot (Dpiloto)** | `backend/src/paid/google-ads.*`, `google-campaign-*`, `optimizer/integrations/googleAds.integration.ts` | Criar/gerir campanhas paid | `/api/paid/oauth/google` + tabelas `paid_ads_*` |

## Regras de alteração (produção)

1. **Não** partilhar a mesma tabela OAuth entre stacks.
2. Mudança em upload/conversões → `modules/googleAds` + `track` / ledger; testes `test:unit` relevantes.
3. Mudança em criação de campanhas → `paid/*`; testes `test:paid`.
4. Helpers puros de formato (ex. CSV offline) podem viver em `lib/` e ser importados por analytics — **não** misturar clientes API das duas stacks num único serviço “mega”.
5. Entry points afiliado reexportados em `backend/src/lib/googleAdsStacks.ts` (documentação viva) — paid **não** importa daí.

Mapa geral: [ARQUITETURA_DCLICKORA.md](./ARQUITETURA_DCLICKORA.md) §6.

## Gestor Google Ads (Paid UI)

Rotas UI sob `/tracking/dpilot/p/:projectId/google/*` (visão, campanhas com métricas, inventário, recomendações, IA, histórico).

API Paid correspondente:

- `GET /api/paid/projects/:projectId/google-ads/overview`
- `GET …/google-ads/campaigns-metrics`
- `GET …/google-ads/inventory`
- `GET …/google-ads/recommendations`
- `POST …/google-ads/ai-insights`
- `POST …/campaigns/:campaignId/duplicate-google`

Duplicação cria rascunho local (novos IDs); publicação na Google reutiliza `create_campaign` + Copilot/Autopilot.

Operações afiliado (evitar ads.google.com no dia a dia):

- `GET …/campaigns/:id/google-ads/search-terms` + `POST …/search-terms/negate` (merge + `sync_campaign_negative_keywords`)
- `GET …/google-ads/keyword-metrics`
- Orçamento / pausa / duplicar com publish a partir do hub `google/campanhas`
- `GET …/google-ads/remote-campaigns` + `POST …/google-ads/import-campaigns` (Search criadas fora da app)
- `GET …/campaigns/:id/google-ads/rsa-policy` (approval_status real)
- `POST …/google-ads/recommendations/action` (apply/dismiss com confirmação)
- `GET …/google-ads/device-performance`
- Orçamento partilhado: `update_budget` bloqueia se `explicitly_shared` e `reference_count > 1`

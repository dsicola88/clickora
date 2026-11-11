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

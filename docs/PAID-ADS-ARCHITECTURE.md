# Anúncios pagos (Paid Ads) no monólito Clickora

Este documento fixa decisões de modelo de dados, deploy e o papel do pacote legado `dpilotoaut/`.

## 1. Onde vive o produto

- **UI:** `frontend/src/pages/dpilot/` — componente `DpilotPaidApp` na rota `/tracking/dpilot/*` (índice redireciona; URLs com projecto: `/tracking/dpilot/p/<uuid>/...`), mesmo login JWT que o resto do dclickora. Mapa de paridade com o pacote de referência: [docs/DPILOT-PARITY.md](./DPILOT-PARITY.md).
- **API:** `backend/` → prefixo `/api/paid/*` e callbacks OAuth em `/api/paid/oauth/*/callback`.
- **Dados:** tabelas `paid_ads_*` no **mesmo PostgreSQL** que presells/tracking (`backend/prisma/schema.prisma`).

Não há iframe de outra app em produção: o fluxo antigo (dpilotoaut + `VITE_DPILOTO_APP_URL` + SSO) foi substituído por esta integração.

## 2. Decisão: `organization` → `user_id` (tenant)

No protótipo **dpilotoaut**, cada “organização” isolava dados de paid media. No Clickora, o tenant de negócio já é o **utilizador dono da subscrição** (`tenantUserId` no JWT = dono do workspace / faturação).

**Mapeamento:**

| Antigo (dpilotoaut) | Monólito Clickora |
|---------------------|-------------------|
| `organization_id` | `user_id` na tabela — **sempre** o ID do utilizador **dono** dos dados (`tenantUserId`) |
| Membros da org | `WorkspaceMember`: quem pode ler/escrever resolve-se em `backend/src/paid/permissions.ts` |

Todas as linhas `paid_ads_*` que carregam `user_id` referem esse dono. Projetos (`paid_ads_projects`) pertencem a um único `userId`; membros da equipa acedem via verificação de workspace, não duplicando linhas por membro.

**Migração de dados** de uma BD dpilotoaut antiga para Clickora não é automática neste repositório: seria um script one-off (mapear `organization` → `users.id` do dono) se ainda tiveres dados em produção no schema antigo.

## 3. Variáveis de ambiente (camadas)

### Obrigatórias para o núcleo (já habitual no Clickora)

- `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (CORS)

### Anúncios + OAuth (por funcionalidade)

| Necessidade | Variáveis |
|-------------|-----------|
| Plano Premium com módulo | `dpilot_ads_enabled` no plano (seed/admin) — não é env, é BD |
| Callbacks OAuth com URL estável | **`PUBLIC_API_URL`** (ou `API_PUBLIC_URL` / `BACKEND_PUBLIC_URL`) — base **HTTPS da API** sem path, ex. `https://clickora-production.up.railway.app`. Usada para montar `…/api/paid/oauth/google|meta|tiktok/callback` quando não defines redirect explícito. |
| Voltar ao site após OAuth | **`PAID_OAUTH_FRONTEND_RETURN_URL`** ou o 1.º valor de **`FRONTEND_URL`** — onde o browser aterra (`/tracking/dpilot?…`). |
| Google Ads API + OAuth | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` |
| Meta | `META_APP_ID`, `META_APP_SECRET`; opcional `META_OAUTH_REDIRECT_URL` |
| Plano de campanha Meta / **Google Search** (IA) no monólito | `OPENAI_API_KEY` (e opcional `ANTHROPIC_API_KEY` só no fluxo Meta) — Google Search: sem chave, plano **determinístico** |
| Página a promover (Graph) | `META_PAGE_ID` ou `META_PROMOTED_PAGE_ID` — necessário para publicar após aprovação / autopilot |
| TikTok | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`; opcional `TIKTOK_OAUTH_REDIRECT_URL` |

Podes fixar redirects **completos** no painel Google/Meta/TikTok (`GOOGLE_OAUTH_REDIRECT_URL`, etc.) e não depender de `PUBLIC_API_URL`.

### Legado (opcional, sem efeito no monólito atual)

- `DPILOTO_PUBLIC_ORIGINS` — mantido no CORS só por compatibilidade; o módulo satélite iframe não é mais o caminho de produção.
- `CLICKORA_DPILOT_SSO_SECRET` — **já não usado** pela API Clickora (endpoint SSO removido).

## 4. Arranque do servidor

O backend pode registar no log (em `NODE_ENV=production`) avisos se faltarem variáveis críticas para OAuth. Ver `backend/src/paid/paidEnvCheck.ts`.

## 5. Pacote `dpilotoaut/` (legado / referência)

A pasta **não** faz parte do build de produção do site dclickora. Mantém código de referência (TanStack Start, server functions) e pode ser útil para copiar comportamentos; não é necessário para `/tracking/dpilot` em produção.

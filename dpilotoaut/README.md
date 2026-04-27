> **Legado / referência — não é o produto de anúncios em produção no dclickora.**  
> O Clickora serve anúncios no **monólito** (`backend` + `frontend`, rotas `/api/paid`, UI `/tracking/dpilot`). Esta pasta mantém o protótipo TanStack Start / org-scoped para consulta.

---

# Paid Autopilot — V1 (Google Ads) + V2 (Meta Ads)

Operational automation for **Google Ads Search** and **Meta Ads (Facebook + Instagram)** with **human-in-the-loop** controls. Promise: control + safety, not guaranteed ROAS.

## V2 — Meta Ads (BYOK)

- Routes: `/app/projects/:id/paid/meta` (overview), `/paid/meta/campaigns`, `/paid/meta/wizard`.
- Reuses `paid_campaigns` (with `platform = 'meta_ads'`) + `paid_change_requests` approval pipeline.
- New tables: `meta_connections`, `meta_adsets`, `meta_creatives`, `meta_ads`. All RLS org-scoped.
- AI: BYOK. Set `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` as a server secret. If neither is set, a deterministic fallback generates 3 creative variants so the flow still works end-to-end.
- **Meta OAuth ativo**: o botão "Conectar Meta Ads" inicia OAuth real. Configure como secrets de servidor:
  - `META_APP_ID` — App ID do Facebook for Developers
  - `META_APP_SECRET` — App Secret
  - `META_OAUTH_REDIRECT_URL` (opcional) — defaulta para `<origin>/hooks/meta-oauth/callback`
  - No painel do app Meta: registre o redirect URI exatamente como acima e solicite os scopes `ads_management`, `ads_read`, `business_management` (App Review obrigatório para uso em produção).
- **Job de sync**: `pg_cron` agenda `meta-ads-sync-hourly` (minuto 7 de cada hora) chamando `/hooks/meta-sync`. Ela atualiza `paid_campaigns.status`, `meta_adsets.status`, `meta_ads.status` e `meta_connections.last_sync_at`/`error_message` via Graph API v21.0. Conexões com `status='error'` mostram a mensagem na overview e podem ser desconectadas pelo botão.
- Compliance: every Meta change request includes a notice that the advertiser is responsible for Meta policies (special ad categories, etc.).
- Money: Meta budgets stored in **cents** in `meta_adsets.daily_budget_cents` (parent `paid_campaigns.daily_budget_micros` mirrors the value for cross-platform reporting).

## Sign in with Google (conta de utilizador)

- Botões em `/auth/sign-in` e `/auth/sign-up` quando estiverem definidos `GOOGLE_AUTH_CLIENT_ID` e `GOOGLE_AUTH_CLIENT_SECRET` (ou o par genérico `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` no **mesmo** cliente OAuth “Web” com redirect `…/hooks/auth-google/callback`).
- **Não** é a mesma coisa que o OAuth **Google Ads** (ligação à API de anúncios: `GOOGLE_ADS_CLIENT_*` e outro scope).
- Utilizador só com Google: `password_hash` fica a `null` na tabela `users`; quem liga a mesma `email` a uma conta com senha passa a poder usar ambos (associa `google_sub` no primeiro login Google).

## Modes

- **Copilot** — AI proposes campaigns / ad groups / keywords / RSA copy. Nothing publishes without explicit approval.
- **Autopilot (guarded)** — System may apply only changes inside the configured guardrails (max daily budget, max CPC, allowed geos, blocked keywords, approval threshold). Anything outside the rails becomes a `pending` change request.

## Tech

- React + TypeScript on **TanStack Start** (file-based router, server functions, runs on Cloudflare Workers).
- **Lovable Cloud** (Postgres + Auth + RLS). Frontend uses the publishable key only; service-role key is server-only.
- AI via **Lovable AI Gateway** server functions — no API key required from you. Set `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` in `secrets` only if you swap providers.

## Data model

- `organizations`, `organization_members(role)`, `projects(paid_mode)`
- `google_ads_connections(status, token_ref)` — opaque token reference; raw secrets never reach the browser.
- `paid_campaigns`, `paid_ad_groups`, `paid_keywords`, `paid_ads_rsa`
- `paid_change_requests(type, payload, status)` — the approval pipeline
- `paid_guardrails` — hard limits per project
- `ai_runs` — full audit log of AI calls

All tables have **Row Level Security** enabled, scoped by org membership and role. Helpers (`is_org_member`, `has_org_role`, `can_*_project`) are `SECURITY DEFINER` to avoid recursive policies.

## Routes

- `/app/projects/:id/paid` — overview (mode, connection, mocked spend chart, guardrails editor)
- `/app/projects/:id/paid/campaigns` — campaign list
- `/app/projects/:id/paid/campaigns/new` — AI plan wizard → drafts + pending change request
- `/app/projects/:id/paid/approvals` — diff preview, approve / reject / **simulate apply**
- `/app/projects/:id/paid/audit` — AI runs + change-request history
- `/app/projects/:id/organization/members` — equipa, **transferir owner**, **convites** (link de uso único, opcional restringir a e-mail) e sair / remover
- `/auth/accept-invite?token=…` — aceitar convite (sessão obrigatória; redireciona a partir de sign-in/sign-up com `?invite=` o mesmo token)

## Money / micros

Google Ads stores money as **micros**: `1 USD = 1_000_000 micros`. All `*_micros` columns follow this. See `src/lib/format.ts`.

## Honest MVP limitations

- **Google Ads OAuth + publish is stubbed.** The "Connect Google Ads" CTA is intentionally disabled. The data model + payloads are exactly what we'd send to the Ads API later.
- **"Simulate apply"** marks an approved change request as `applied` and flips the related campaign to `live` so you can exercise the full flow end-to-end.
- Spend chart on overview is mocked until real Ads-API sync is wired.

### Future work — required env vars for real Google Ads

Add these as Lovable Cloud secrets, then implement the OAuth callback + Google Ads API client server-side:

```
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=     # MCC, optional
GOOGLE_ADS_OAUTH_REDIRECT_URL=    # https://yourapp.com/api/google-ads/callback
```

The token, once exchanged, should be stored in a **server-only** table (or vault) and only an opaque `token_ref` should live in `google_ads_connections.token_ref`.

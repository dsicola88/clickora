# Variáveis de ambiente — DClickora

**Não colocar credenciais reais neste ficheiro.** Exemplos são placeholders.

Referências existentes: `backend/.env.example`, `frontend/.env.example`, `docs/ENV-SETUP.md`, `docs/DEPLOYMENT.md`.

## 1. Frontend (Vercel / local)

| Variável | Obrigatória | Exemplo | Notas |
|----------|-------------|---------|--------|
| `VITE_PUBLIC_API_URL` | Produção: sim | `https://api.exemplo.com/api` | Preferida; embed no build |
| `VITE_API_URL` | Alternativa | `http://localhost:3001/api` | Legado / local |
| `VITE_GOOGLE_CLIENT_ID` | OAuth login Google | `….apps.googleusercontent.com` | Mesmo client que backend |

## 2. Backend — núcleo

| Variável | Obrigatória | Exemplo | Notas |
|----------|-------------|---------|--------|
| `DATABASE_URL` | Sim | `postgresql://clickora:clickora@localhost:5434/clickora?schema=public` | Local Docker: porta **5434** |
| `JWT_SECRET` | Sim (prod) | `(openssl rand -hex 32)` | Em produção: **mín. 32 chars**; `changeme` **rejeitado** no boot (`jwt.ts`) |
| `JWT_EXPIRES_IN` | Não | `7d` | |
| `PORT` | Não | `3001` | |
| `NODE_ENV` | Prod: `production` | `development` | |
| `FRONTEND_URL` | Sim (CORS) | `http://localhost:8080,https://www.dclickora.com` | Vírgula-separado |
| `ENCRYPTION_KEY` | **Prod fortemente recomendado** | `openssl rand -hex 32` | AES-256-GCM; sem isto tokens em texto claro |
| `PUBLIC_API_URL` / `API_PUBLIC_URL` | Paid OAuth | `https://….up.railway.app` ou com `/api` | Callbacks `/api/paid/oauth/*/callback` |

## 3. Pagamentos (Hotmart)

| Variável | Exemplo |
|----------|---------|
| `HOTMART_WEBHOOK_TOKEN` | hottok da Hotmart |
| `HOTMART_WEBHOOK_SECRET` | opcional HMAC |
| `HOTMART_PLAN_MAP` | `{"OFFER123":"monthly"}` |
| `HOTMART_DEFAULT_PLAN_TYPE` | `monthly` |
| `HOTMART_PRODUCT_URL` | URL checkout |

Ver `docs/PAGAMENTOS-ANGOLA.md`.

## 4. Anúncios (Paid) OAuth

| Variável | Plataforma |
|----------|------------|
| `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` | Google |
| `META_APP_ID`, `META_APP_SECRET` | Meta |
| `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` | TikTok |
| `PAID_OAUTH_FRONTEND_RETURN_URL` | Redirect pós-OAuth (senão 1.º `FRONTEND_URL`) |

## 5. Integrações afiliado (Conversion Upload / CAPI)

Definidas no `.env.example` e/ou por utilizador no painel (tokens encriptados com `ENCRYPTION_KEY`).

## 6. Storage e media

| Variável | Notas |
|----------|--------|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Obrigatório em produção para sobreviver a redeploys |

## 7. Enterprise / opcional

| Variável | Uso |
|----------|-----|
| `OIDC_*` | SSO empresa |
| `MFA_ISSUER` | TOTP |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` | Domínios custom SSL |
| `DPILOTO_PUBLIC_ORIGINS` | **Legado** CORS apenas |
| `TRACK_RATE_LIMIT_MAX`, `TRACK_RATE_LIMIT_WINDOW_MS` | Rate limit tracking (default 240/min/IP). Sem `REDIS_URL`: **em memória** por processo. Com `REDIS_URL`: partilhado entre réplicas |
| `REDIS_URL` | Opcional. Redis para rate limit de `/track` multi-instância |
| `TRACK_CSV_MAX_ROWS` | Limite de linhas por import CSV offline (default 5000) |
| `PRISMA_CONNECTION_LIMIT`, `PRISMA_POOL_TIMEOUT` | Pool Prisma se a `DATABASE_URL` não declarar `connection_limit` (defaults 25 / 20) |
| `SENTRY_DSN` | Se configurado |

## 8. Checklist produção (sem valores)

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` ≥ 32 caracteres (não `changeme`)
- [ ] `ENCRYPTION_KEY` definida (32 bytes)
- [ ] `FRONTEND_URL` inclui www + apex
- [ ] `VITE_PUBLIC_API_URL` alinhado com Railway
- [ ] R2 completo
- [ ] Hotmart webhook configurado
- [ ] Credenciais OAuth paid só se o plano vende anúncios

## 9. Ambiente desta auditoria (2026-10-30)

Observado no `.env` **local** do developer (sem imprimir segredos):

| Chave | Estado |
|-------|--------|
| `DATABASE_URL` | Aponta para host Railway proxy (`*.rlwy.net`) — **não usar para load tests** |
| `JWT_SECRET` | **MISSING** no `.env` local → fallback `changeme` só em non-production |
| `ENCRYPTION_KEY` | **MISSING** no `.env` local |
| Docker Postgres Clickora | **`:5434`** (5433 estava ocupada por outro contentor `dhundo-postgres`) |
| API `:3001` | Validada na re-auditoria local 2026-10-30 |

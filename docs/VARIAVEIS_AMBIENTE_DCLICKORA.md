# Variáveis de ambiente — DClickora

**Actualizado:** 2026-10-30 (Etapa 6)  
**Não colocar credenciais reais neste ficheiro.** Exemplos são placeholders.

Referências: `backend/.env.example`, `frontend/.env.example`, [ENV-SETUP.md](./ENV-SETUP.md), [DEPLOYMENT.md](./DEPLOYMENT.md).

## 1. Frontend (Vercel / local)

| Variável | Obrigatória | Exemplo | Notas |
|----------|-------------|---------|--------|
| `VITE_PUBLIC_API_URL` | Produção: sim | `https://api.exemplo.com/api` | Preferida; embed no build |
| `VITE_API_URL` | Alternativa | `http://localhost:3001/api` | Legado / local |
| `VITE_GOOGLE_CLIENT_ID` | OAuth login Google | `….apps.googleusercontent.com` | Mesmo client que backend |

## 2. Backend — núcleo

| Variável | Obrigatória | Exemplo | Notas |
|----------|-------------|---------|--------|
| `DATABASE_URL` | Sim | `postgresql://clickora:clickora@localhost:5434/clickora?schema=public` | Local Docker: porta **5434**. **Nunca** usar Railway em scripts de carga/IDOR |
| `JWT_SECRET` | Sim (prod) | `(openssl rand -hex 32)` | Em produção: **mín. 32 chars**; `changeme` **rejeitado** no boot (`jwt.ts`) |
| `JWT_EXPIRES_IN` | Não | `7d` | |
| `PORT` | Não | `3001` | |
| `NODE_ENV` | Prod: `production` | `development` | |
| `FRONTEND_URL` | Sim (CORS) | `http://localhost:8080,https://www.dclickora.com` | Vírgula-separado |
| `ENCRYPTION_KEY` | **Sim em produção** | `openssl rand -hex 32` | AES-256-GCM; boot falha sem chave em `NODE_ENV=production` (`fieldEncryption.assertProductionEncryptionKey`) |
| `PUBLIC_API_URL` / `API_PUBLIC_URL` | Paid OAuth | `https://….up.railway.app` ou com `/api` | Callbacks `/api/paid/oauth/*/callback` |

## 3. Pagamentos (Hotmart)

| Variável | Exemplo |
|----------|---------|
| `HOTMART_WEBHOOK_TOKEN` | hottok da Hotmart |
| `HOTMART_WEBHOOK_SECRET` | opcional HMAC |
| `HOTMART_PLAN_MAP` | `{"OFFER123":"monthly"}` |
| `HOTMART_DEFAULT_PLAN_TYPE` | `monthly` |
| `HOTMART_PRODUCT_URL` | URL checkout |

Ver [PAGAMENTOS-ANGOLA.md](./PAGAMENTOS-ANGOLA.md).

## 4. Anúncios (Paid) OAuth

| Variável | Plataforma |
|----------|------------|
| `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` | Google |
| `META_APP_ID`, `META_APP_SECRET` | Meta |
| `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` | TikTok |
| `PAID_OAUTH_FRONTEND_RETURN_URL` | Redirect pós-OAuth (senão 1.º `FRONTEND_URL`) |

Tokens de ligação guardados via `paid/tokenSecrets.ts` (encriptados se `ENCRYPTION_KEY` existir).

## 5. Integrações afiliado (Conversion Upload / CAPI)

Definidas no `.env.example` e/ou por utilizador no painel (tokens encriptados com `ENCRYPTION_KEY`).

## 6. Storage e media

| Variável | Notas |
|----------|--------|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Obrigatório em produção para sobreviver a redeploys |

Ver [IMAGENS-E-ARMAZENAMENTO.md](./IMAGENS-E-ARMAZENAMENTO.md).

## 7. Enterprise / performance / opcional

| Variável | Uso |
|----------|-----|
| `OIDC_*` | SSO empresa |
| `MFA_ISSUER` | TOTP |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` | Domínios custom SSL |
| `DPILOTO_PUBLIC_ORIGINS` | **Legado** CORS apenas |
| `TRACK_RATE_LIMIT_MAX`, `TRACK_RATE_LIMIT_WINDOW_MS` | Rate limit tracking (default 240/min/IP) |
| `REDIS_URL` | Opcional. Sem: rate-limit **em memória** por processo. Com: partilhado entre réplicas (`ioredis`) |
| `TRACK_CSV_MAX_ROWS` | Limite de linhas por import CSV offline (default 5000) |
| `PRISMA_CONNECTION_LIMIT`, `PRISMA_POOL_TIMEOUT` | Pool Prisma se a `DATABASE_URL` não declarar `connection_limit` (defaults 25 / 20) |
| `SENTRY_DSN` | Se configurado |

## 8. Scripts de carga e isolamento (dev/staging only)

| Variável | Uso |
|----------|-----|
| `LOAD_TEST_BASE_URL` | Base HTTP (ex. `http://127.0.0.1:3001`) — hosts produção **recusados** |
| `ALLOW_LOAD_TEST` | `1` para permitir smoke em hosts de staging autorizados pela allowlist do script |
| `ALLOW_MUTATING_LOAD_TEST` | `1` + `DATABASE_URL` localhost para load/IDOR que escrevem na BD |
| `DATABASE_URL` | Deve ser Postgres local (`localhost` / `127.0.0.1` / Docker) |

Detalhe: [TESTES_CARGA_DCLICKORA.md](./TESTES_CARGA_DCLICKORA.md), [SEGURANCA_E_ISOLAMENTO.md](./SEGURANCA_E_ISOLAMENTO.md).

## 9. Checklist produção (sem valores)

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` ≥ 32 caracteres (não `changeme`) — **boot falha** caso contrário
- [ ] `ENCRYPTION_KEY` definida (32 bytes hex típico) — **boot falha** se ausente
- [ ] Após activar `ENCRYPTION_KEY` pela 1.ª vez: utilizadores re-ligam OAuth paid se tokens estavam em claro
- [ ] `FRONTEND_URL` inclui www + apex
- [ ] `VITE_PUBLIC_API_URL` alinhado com API pública
- [ ] R2 completo
- [ ] Hotmart webhook configurado
- [ ] Credenciais OAuth paid só se o plano vende anúncios
- [ ] `REDIS_URL` se houver >1 réplica da API e tracking crítico

## 10. Ambiente de desenvolvimento (notas de auditoria)

Observações típicas em máquinas de developer (sem imprimir segredos):

| Chave | Boas práticas |
|-------|----------------|
| `DATABASE_URL` | Docker `:5434` — **não** Railway proxy |
| `JWT_SECRET` / `ENCRYPTION_KEY` | Definir localmente para espelhar prod; opcional em `development` |
| API | `:3001` |
| Vite | `:8080` |

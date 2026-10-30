# Guia do desenvolvedor — DClickora

Objetivo: um programador sénior conseguir instalar, correr, testar e alterar módulos **sem depender do autor original**.

## 1. Pré-requisitos

- Node.js **20+**
- npm (monorepo root usa `npm --prefix`)
- Docker Desktop **ou** PostgreSQL 14+
- Não é Next.js / pnpm no núcleo

## 2. Instalação local

```bash
# Raiz
npm install
npm --prefix backend install
npm --prefix frontend install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# BD local (recomendado — NÃO apontar DATABASE_URL para produção)
docker compose up -d
# DATABASE_URL=postgresql://clickora:clickora@localhost:5434/clickora?schema=public

npm run api:db:migrate
npm run api:db:seed
npm run dev   # API + Vite
```

Utilizadores de seed: ver `README.md` / `backend/prisma/seed.ts`.

## 3. Estrutura

```
frontend/src/
  pages/          # rotas de produto
  pages/dpilot/   # UI anúncios (in-app)
  components/     # UI partilhada
  lib/            # clientes API, nav, gates
backend/src/
  server.ts       # entrada
  controllers/    # HTTP
  routes/         # montagem + middleware
  middleware/     # auth, tenant, rate limit
  lib/            # prisma, jwt, tracking, encryption
  paid/           # produto anúncios
  modules/        # googleAds / metaCapi / tiktokEvents / affiliateOps
  compliance/     # gates de publicação de presells
backend/prisma/   # schema + migrations + seed
docs/             # operação e produto
```

## 4. Como alterar um módulo sem quebrar outros

| Regra | Porquê |
|-------|--------|
| Dados de negócio: filtrar sempre por `userId` / `billingUserId` / `tenantUserId` | Isolamento multi-tenant |
| Rotas autenticadas de produto: `authenticate` + `tenantIsolation` + `requireActiveSubscription` | Padrão actual |
| Mutações sensíveis: preferir `systemPrisma` **depois** de validar ownership | Evita AND inválido no `update`/`delete` por `id` |
| Novos modelos com `userId`: acrescentar a `USER_ID_MODELS` em `tenantPrisma.ts` | Cliente tenant passa a filtrar |
| Não devolver segredos OAuth nos DTOs | Ver `paid/api-mappers.ts` |
| Tokens paid: `storePaidToken` / `loadPaidToken` | `paid/tokenSecrets.ts` |
| Não mudar contratos JSON sem verificar `frontend/src` | Clientes React acoplados |

## 5. Testes

```bash
# Backend unitários (lista explícita em package.json)
cd backend && npm run test:unit

# Paid / optimizer
cd backend && npm run test:paid

# Isolamento presell (precisa DATABASE_URL local com dados de teste)
cd backend && npm run test:presell-multitenant

# Frontend unit
cd frontend && npm test

# Playwright (precisa app a correr + credenciais de teste)
cd frontend && npm run test:e2e

# Load smoke SEGURO (só localhost / staging com ALLOW_LOAD_TEST=1)
cd backend && LOAD_TEST_BASE_URL=http://127.0.0.1:3001 npx tsx scripts/load-smoke-safe.ts
```

Scripts de auditoria E2E adicionais: `backend/scripts/e2e-*.ts` (muitos exigem staging + credenciais).

## 6. Módulos — ficha rápida

### Auth

1. Responsabilidade: registo, login, JWT, MFA, OIDC, reset password  
2. Local: `controllers/auth.controller.ts`, `mfa.controller.ts`, `oidc.controller.ts`  
3. Endpoints: `/api/auth/*`  
4. Tabelas: `users`, MFA fields, `subscriptions` (acesso)  
5. Testes: fluxos cobertos parcialmente por e2e Playwright `login.spec.ts`

### Presells

1. Criação manual/automática, publish, compliance, public slug  
2. `controllers/presell.controller.ts`, `compliance/`  
3. `/api/presells`, `/api/public/presells`  
4. `presell_pages`, audits de compliance  
5. `npm run test:e2e-presell-flow`, Playwright `presell-*.spec.ts`

### Tracking

1. Cliques, impressões, redirects, postbacks, evidência de visitante  
2. `controllers/track.controller.ts`, `lib/trackGuard.ts`, `lib/clickVisitorEvidence.ts`  
3. `/api/track/*` (maioritariamente público)  
4. `tracking_events`, `conversions`, `postback_logs`  
5. `clickVisitorEvidence.e2e.test.ts`, `trackGuard` unit

### Anúncios (Paid)

1. Projectos, OAuth Google/Meta/TikTok, publish, optimizer  
2. `backend/src/paid/*`, UI `frontend/src/pages/dpilot`  
3. `/api/paid/*`  
4. `paid_ads_*`  
5. `npm run test:paid`

### Assinaturas

1. Planos, subscribe (redirect Hotmart), cancel, webhook  
2. `plans.controller.ts`, `webhook.controller.ts`, `lib/subscription.ts`  
3. `/api/plans`, `/api/webhooks/hotmart`  
4. `plans`, `subscriptions`  
5. `subscription.hotmart.test.ts`

## 7. Deploy

Ver `docs/DEPLOYMENT.md` e `docs/VARIAVEIS_AMBIENTE_DCLICKORA.md`.

## 8. Backups

Ver `docs/POSTGRES-BACKUP.md` e scripts `backend/scripts/postgres-backup-*.ts`.

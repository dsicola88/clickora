# Guia do desenvolvedor — DClickora

**Actualizado:** 2026-10-30 (Etapa 6)  
**Objectivo:** um programador sénior instalar, correr, testar e alterar módulos **sem depender do autor original**.

Mapa de docs: [INDICE_DOCUMENTACAO_DCLICKORA.md](./INDICE_DOCUMENTACAO_DCLICKORA.md).

## 1. Pré-requisitos

- Node.js **20+**
- npm (monorepo root usa `npm --prefix`; não é Next.js / pnpm no núcleo)
- Docker Desktop **ou** PostgreSQL 14+
- Opcional: Redis (`REDIS_URL`) para rate-limit de `/track` multi-réplica

## 2. Instalação local

```bash
# Raiz
npm install
npm --prefix backend install
npm --prefix frontend install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Crítico — `DATABASE_URL`:**

```env
DATABASE_URL=postgresql://clickora:clickora@localhost:5434/clickora?schema=public
```

Não apontar o `.env` de desenvolvimento para Railway / produção. Scripts de carga e IDOR **bloqueiam** hosts de produção.

```bash
docker compose up -d
npm run api:db:migrate
npm run api:db:seed
npm run dev   # API :3001 + Vite :8080
```

Utilizadores de seed: `README.md` / `backend/prisma/seed.ts`.

### Segredos em local

| Variável | Local | Produção |
|----------|-------|----------|
| `JWT_SECRET` | opcional (fallback `changeme` só em non-prod) | **≥ 32 chars**; boot falha se fraco |
| `ENCRYPTION_KEY` | opcional (tokens paid em claro) | **obrigatória**; boot falha se ausente (`fieldEncryption.assertProductionEncryptionKey`) |

Gerar: `openssl rand -hex 32`.

## 3. Estrutura

```
frontend/src/
  pages/          # rotas de produto
  pages/dpilot/   # UI anúncios (lazy: DpilotPaidApp)
  components/     # UI partilhada
  lib/            # clientes API, nav, gates, lucide-icon
backend/src/
  server.ts       # entrada + assertProductionEncryptionKey
  controllers/    # HTTP
  routes/         # montagem + middleware
  middleware/     # auth, tenant, trackRateLimit
  lib/            # prisma, jwt, tenantPrisma, encryption, destinationProbe
  paid/           # anúncios + tokenSecrets + api-mappers
  modules/        # googleAds / metaCapi / tiktokEvents / affiliateOps
  compliance/     # gates de publicação de presells
backend/prisma/   # schema + migrations + seed
backend/scripts/  # load-*, security-isolation-suite, e2e-*, backups
docs/             # operação e produto (ver INDICE)
```

## 4. Como alterar um módulo sem quebrar outros

| Regra | Porquê |
|-------|--------|
| Dados de negócio: filtrar sempre por `userId` / `billingUserId` / `tenantUserId` | Isolamento multi-tenant |
| Rotas autenticadas de produto: `authenticate` + `tenantIsolation` + `requireActiveSubscription` | Padrão actual |
| Paid: + `requireDpilotPlan` onde aplicável | Gate de feature |
| Mutações sensíveis: preferir `systemPrisma` **depois** de validar ownership | Evita AND inválido no `update`/`delete` por `id` |
| Novos modelos com `userId`: acrescentar a `USER_ID_MODELS` em `tenantPrisma.ts` | Cliente tenant passa a filtrar |
| Paid updates: usar `updateMany({ where: { id, userId } })` ou ownership prévia | IDOR |
| Não devolver segredos OAuth nos DTOs | `paid/api-mappers.ts` |
| Tokens paid: `storePaidToken` / `loadPaidToken` | `paid/tokenSecrets.ts` |
| SSRF: destinos externos via `destinationProbe` / `safeImportFetch` | pin IP + bloqueio privado |
| Não mudar contratos JSON sem verificar `frontend/src` | Clientes React acoplados |

## 5. Testes

```bash
# Backend unitários (lista explícita em package.json)
cd backend && npm run test:unit

# Paid / optimizer
cd backend && npm run test:paid

# Isolamento presell (precisa DATABASE_URL local com dados)
cd backend && npm run test:presell-multitenant

# Frontend unit + build
cd frontend && npm test
cd frontend && npm run build

# Playwright (app a correr + credenciais de teste)
cd frontend && npm run test:e2e
```

### Carga (nunca produção)

```bash
cd backend
npm run test:load-safety
LOAD_TEST_BASE_URL=http://127.0.0.1:3001 npm run load:smoke
# Mutações: ALLOW_MUTATING_LOAD_TEST=1 + DATABASE_URL localhost
# Ver docs/TESTES_CARGA_DCLICKORA.md
```

### Isolamento / IDOR

```bash
cd backend
# Suite: scripts/security-isolation-suite.ts — exige DB local + anti-produção
# Ver docs/SEGURANCA_E_ISOLAMENTO.md
```

Scripts E2E adicionais: `backend/scripts/e2e-*.ts` (muitos exigem staging + credenciais).

## 6. Módulos — ficha rápida

### Auth

1. Responsabilidade: registo, login, JWT, MFA, OIDC, reset password  
2. Local: `controllers/auth.controller.ts`, `mfa.controller.ts`, `oidc.controller.ts`  
3. Endpoints: `/api/auth/*`  
4. Tabelas: `users`, MFA fields, `subscriptions` (acesso)  
5. Testes: Playwright `login.spec.ts`; boot JWT em produção em `lib/jwt.ts`

### Presells

1. Criação manual/automática, publish, compliance, public slug  
2. `controllers/presell.controller.ts`, `compliance/`  
3. `/api/presells`, `/api/public/presells`  
4. `presell_pages`, audits de compliance  
5. `npm run test:e2e-presell-flow`, Playwright `presell-*.spec.ts`

### Tracking

1. Cliques, impressões, redirects, postbacks, evidência de visitante  
2. `controllers/track.controller.ts`, `lib/trackGuard.ts`, `middleware/trackRateLimit.ts`  
3. `/api/track/*` (maioritariamente público; rate-limit IP; Redis se `REDIS_URL`)  
4. `tracking_events`, `conversions`, `postback_logs`  
5. `clickVisitorEvidence.e2e.test.ts`, `trackGuard` unit

### Anúncios (Paid)

1. Projectos, OAuth Google/Meta/TikTok, publish, optimizer  
2. `backend/src/paid/*`, UI `frontend/src/pages/dpilot` (lazy)  
3. `/api/paid/*`  
4. `paid_ads_*` — isolamento por `userId` do projecto  
5. `npm run test:paid`; tokens: `tokenSecrets.ts`

### Assinaturas

1. Planos, subscribe (redirect Hotmart), cancel, webhook  
2. `plans.controller.ts`, `webhook.controller.ts`, `lib/subscription.ts`  
3. `/api/plans`, `/api/webhooks/hotmart`  
4. `plans`, `subscriptions`  
5. `subscription.hotmart.test.ts`

## 7. Deploy

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) e [VARIAVEIS_AMBIENTE_DCLICKORA.md](./VARIAVEIS_AMBIENTE_DCLICKORA.md).

Checklist mínimo produção:

1. `JWT_SECRET` forte  
2. `ENCRYPTION_KEY` definida (re-OAuth paid após activar encriptação em contas antigas em claro)  
3. `FRONTEND_URL` + `VITE_PUBLIC_API_URL` alinhados  
4. R2 configurado  
5. Hotmart webhook  

## 8. Backups

Ver [POSTGRES-BACKUP.md](./POSTGRES-BACKUP.md) e `backend/scripts/postgres-backup-*.ts`.

## 9. Performance (resumo)

Detalhe: [OTIMIZACAO_PERFORMANCE_DCLICKORA.md](./OTIMIZACAO_PERFORMANCE_DCLICKORA.md).

- CSV conversões: batch (sem N+1)  
- Ícones Lucide: `lib/lucide-icon.ts` + dynamic imports  
- Dpiloto: `React.lazy`  
- Índices track / Prisma pool env  
- Rate-limit track partilhável via Redis  

## 10. Problemas comuns

| Sintoma | Causa típica | Acção |
|---------|--------------|--------|
| Boot falha em production | `JWT_SECRET` / `ENCRYPTION_KEY` | Definir no Railway |
| Load/IDOR recusa URL | Host produção / Railway | Usar `127.0.0.1` + DB `:5434` |
| Prisma timeout local | `DATABASE_URL` aponta Railway | Trocar para Docker `:5434` |
| Tokens paid ilegíveis após ENCRYPTION_KEY | Dados antigos em claro | Utilizador re-liga OAuth |
| Rate limit inconsistente multi-réplica | Sem Redis | Definir `REDIS_URL` |

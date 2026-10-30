# dclickora

Aplicação full-stack em produção:
- **`frontend/`** — React 18 + Vite + TypeScript (app principal: presells, tracking, planos, anúncios em `/tracking/dpilot`)
- **`backend/`** — Node.js + Express + PostgreSQL (Prisma) — **fonte única de auth, planos, anúncios e dados Clickora**

> **Nota:** não é Next.js nem pnpm no núcleo; o root usa **npm** e `npm --prefix` para cada pacote. Migrar para `pnpm` + `workspaces` é opcional.

## Monorepo (estado actual)

| Pasta | Papel | Base de dados | Auth |
|--------|--------|----------------|------|
| `frontend` + `backend` | Produto Clickora (incl. **anúncios** em `/tracking/dpilot`) | `backend/prisma` → Postgres Clickora (tabelas `paid_ads_*`, tenant por `userId`) | JWT + OAuth de anúncios no mesmo backend |

**Modelo de dados:** o isolamento de paid media é por **utilizador dono** (`userId` nas tabelas `paid_ads_*`), alinhado ao tenant de faturação — ver `docs/PAID-ADS-ARCHITECTURE.md`.

**Layout futuro (alvo opcional):**

```
apps/
  web/          # hoje: frontend/
  api/          # hoje: backend/
packages/       # opcional: ui compartilhado, tipos, eslint-config
```

### Anúncios pagos (Paid Ads)

1. **Gating:** `dpilot_ads_enabled` no plano; rota `/tracking/dpilot` com `userCanAccessDpilotAds` (super_admin ignora).
2. **API:** `POST/GET /api/paid/*`, OAuth em `/api/paid/oauth/*/callback`; variáveis `PUBLIC_API_URL`, credenciais Google/Meta/TikTok e `PAID_OAUTH_FRONTEND_RETURN_URL` (ou `FRONTEND_URL`). Resumo: **[docs/PAID-ADS-ARCHITECTURE.md](docs/PAID-ADS-ARCHITECTURE.md)**.
3. **CORS:** `FRONTEND_URL` como sempre; `DPILOTO_PUBLIC_ORIGINS` é opcional e legado.

Checklist de deploy: **[docs/DEPLOYMENT.md — §6](docs/DEPLOYMENT.md)**.

## Estrutura de pastas

- `frontend/src/`: interface web (presell, tracking, planos, dpilot)
- `backend/src/`: API Express
- `backend/prisma/`: schema e seed do PostgreSQL Clickora
- `frontend/public/`: ficheiros estáticos

## Deploy (produção)

**Auditoria empresarial (2026-10-30):** [docs/AUDITORIA_EMPRESARIAL_DCLICKORA.md](docs/AUDITORIA_EMPRESARIAL_DCLICKORA.md) · [Arquitetura](docs/ARQUITETURA_DCLICKORA.md) · [Guia do desenvolvedor](docs/GUIA_DESENVOLVEDOR_DCLICKORA.md) · [Variáveis de ambiente](docs/VARIAVEIS_AMBIENTE_DCLICKORA.md) · [Fluxos funcionais](docs/FLUXOS_FUNCIONAIS_DCLICKORA.md).

Configuração Vercel + Railway, variáveis `VITE_PUBLIC_API_URL`, CORS e checklist: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.  
Passo a passo frontend ↔ backend e login/CORS: **[docs/ENV-SETUP.md](docs/ENV-SETUP.md)**.  
Imagens (presells, favicon, landing) na Cloudflare — guia simples: **[docs/IMAGENS-E-ARMAZENAMENTO.md](docs/IMAGENS-E-ARMAZENAMENTO.md)**.  
O que os números significam (sem mentir): **[docs/METRICAS-HONESTAS.md](docs/METRICAS-HONESTAS.md)**.  
Para afiliados Google Ads + redes: **[docs/AFILIADO-PROFISSIONAL.md](docs/AFILIADO-PROFISSIONAL.md)**.  
Conformidade preventiva de presells (Google Ads / Microsoft Advertising — verificações internas, sem garantia de aprovação): **[docs/compliance/README.md](docs/compliance/README.md)**.

## Requisitos

- Node.js **20+**
- Docker Desktop (recomendado) **ou** PostgreSQL 14+ local

## Banco de dados (recomendado: Docker)

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe PostgreSQL em `localhost:5434` (usuário `clickora`, senha `clickora`, banco `clickora`).  
(A porta **5434** evita conflito com outros Postgres locais na 5433.)

Copie `backend/.env.example` para `backend/.env` e use:

```env
DATABASE_URL="postgresql://clickora:clickora@localhost:5434/clickora?schema=public"
FRONTEND_URL="http://localhost:8080"
```

Depois:

```bash
npm run api:db:migrate
npm run api:db:seed
```

Em **produção** (Railway / CI, sem prompts interactivos): `npm run api:db:migrate:deploy` — equivale a `prisma migrate deploy` no `backend`. Para alinhar dados dos planos após uma alteração ao seed, podes correr `npm run api:db:seed` na máquina que tenha `DATABASE_URL` correcto (atenção: o seed completo também recria/atualiza utilizadores de teste definidos em `seed.ts`).

### Usuários de teste (após o seed)

Passwords e e-mails exactos: ver `backend/prisma/seed.ts` (podem mudar). Contas actuais do seed:

| Perfil | E-mail | Plano |
|--------|--------|-------|
| Super Admin | `danielclickora@gmail.com` | Pro mensal |
| Utilizador | `danielclickora1@gmail.com` | Pro mensal |
| Admin | `danielclickora2@gmail.com` | Pro mensal |
| Super Admin gerenciador | `dclickora2026@gmail.com` | Pro anual |



## Configuracao

### 1) Frontend

```bash
cp frontend/.env.example frontend/.env
```

Variavel usada:
- `VITE_API_URL`: URL da API (padrao `http://localhost:3001/api`)

### 2) Backend

```bash
cd backend
cp .env.example .env
```

Configure no `backend/.env`:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `FRONTEND_URL`

Vendas com **Hotmart** (ex.: Angola, sem Stripe): `docs/PAGAMENTOS-ANGOLA.md` e variáveis `HOTMART_*` no `backend/.env.example`.

## Rodando localmente

### Instalar dependencias

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Backend

```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Rodar tudo com um comando

```bash
npm run dev
```

Abra o front em `http://localhost:8080` (porta configurada no Vite) e a API em `http://localhost:3001`.

Se o Vite avisar que a porta está em uso e subir em **8081** (ou outra), pode usar normalmente — em desenvolvimento a API aceita qualquer `http://localhost:PORTA`.

### Login dá "NetworkError"

1. Confirme que a API está no ar: abra [http://localhost:3001/api/health](http://localhost:3001/api/health) e deve aparecer `{"status":"ok",...}`.
2. Se der erro de conexão, suba só a API: `npm run api:dev` (e libere a porta 3001 se estiver ocupada: `lsof -i :3001` e encerre o processo).
3. O front chama `VITE_API_URL` ou `http://localhost:3001/api` — não altere a URL da API só porque o front mudou de porta.

## Stack oficial do projeto

- Node.js
- Express
- PostgreSQL
- Prisma ORM
- React + Vite (cliente web principal)

## Verificação após alterações (passo a passo)

Ordem sugerida para não regressar produção:

1. **Build (obrigatório antes de merge/deploy)**
   - `cd backend && npm install && npm run build`
   - `cd frontend && npm install && npm run build && npm run lint`
   - Ou na raiz: `npm run build` e `npm run lint`

2. **E2E do frontend** (Playwright; requer browsers instalados):
   - `cd frontend && npm run test:e2e`
   - Ver `frontend/playwright.config.ts` (API + Vite de teste).

3. **Produção:** o pipeline habitual é `api:build` + `web:build`.

## Observacoes

- Dependencias e arquivos de Lovable/Supabase foram removidos do frontend.
- O backend e totalmente baseado em Express + PostgreSQL.

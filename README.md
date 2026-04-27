# dclickora

Aplicação full-stack em produção:
- **`frontend/`** — React 18 + Vite + TypeScript (app principal: presells, tracking, planos)
- **`backend/`** — Node.js + Express + PostgreSQL (Prisma) — **fonte única de auth, planos e dados Clickora**
- **`dpilotoaut/`** — código de **referência / legado** (TanStack Start, modelo por organização); em produção, anúncios estão no **monólito** (`/api/paid`). Ver `docs/PAID-ADS-ARCHITECTURE.md`

> **Nota:** não é Next.js nem pnpm no núcleo; o root usa **npm** e `npm --prefix` para cada pacote. Migrar para `pnpm` + `workspaces` é opcional e deve ser feito só após alinhar versões (React 18 vs 19, Vite 5 vs 7).

## Monorepo (estado actual e objectivo)

| Pasta | Papel | Base de dados | Auth |
|--------|--------|----------------|------|
| `frontend` + `backend` | Produto principal Clickora (incl. **anúncios** em `/tracking/dpilot`) | `backend/prisma` → Postgres Clickora (tabelas `paid_ads_*`, tenant por `userId`) | JWT + OAuth de anúncios no mesmo backend |
| `dpilotoaut` | Referência / protótipo antigo (não é o deploy de anúncios) | Schema separado na pasta | Não usado pelo site em produção |

**Modelo de dados:** no monólito, o isolamento de paid media é por **utilizador dono** (`userId` nas tabelas `paid_ads_*`), alinhado ao tenant de faturação; `dpilotoaut` usava **organização** — ver `docs/PAID-ADS-ARCHITECTURE.md` para o mapeamento e migração conceptual.

**Layout recomendado (fase final, alvo):**

```
apps/
  web/          # hoje: frontend/ (presell + tracking + entrada Dpiloto)
  api/          # hoje: backend/
packages/       # opcional: ui compartilhado, tipos, eslint-config
```

Mover pastas só quando houver janela de CI/deploy; o nome `frontend`/`backend` pode manter-se indefinidamente se os scripts estiverem estáveis.

**Unificar dependências “onde for seguro”:** hoje **não** convém um único `node_modules` via npm workspaces entre `frontend` e `dpilotoaut` (conflito React 18/19 e Vite). Partilhar pacotes faz sentido **depois** de: (1) alinhar major de React, ou (2) extrair apenas UI pura para `packages/ui` com peer dependencies.

### Anúncios pagos (Paid Ads) — integração actual

1. **Gating:** `dpilot_ads_enabled` no plano; rota `/tracking/dpilot` com `userCanAccessDpilotAds` (super_admin ignora).
2. **API:** `POST/GET /api/paid/*`, OAuth em `/api/paid/oauth/*/callback`; variáveis `PUBLIC_API_URL`, credenciais Google/Meta/TikTok e `PAID_OAUTH_FRONTEND_RETURN_URL` (ou `FRONTEND_URL`). Resumo: **[docs/PAID-ADS-ARCHITECTURE.md](docs/PAID-ADS-ARCHITECTURE.md)**.
3. **CORS:** `FRONTEND_URL` como sempre; `DPILOTO_PUBLIC_ORIGINS` é opcional e legado.

Checklist de deploy: **[docs/DEPLOYMENT.md — §6](docs/DEPLOYMENT.md)**.

## Estrutura de pastas

- `frontend/src/`: interface web (presell, tracking, planos, etc.)
- `backend/src/`: API Express
- `backend/prisma/`: schema e seed do PostgreSQL Clickora
- `frontend/public/`: ficheiros estáticos
- `dpilotoaut/`: app Paid Autopilot (ver `dpilotoaut/README.md`); requer Node **≥ 22.12** conforme o `package.json` desse pacote

## Deploy (produção)

Configuração Vercel + Railway, variáveis `VITE_PUBLIC_API_URL`, CORS e checklist: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.  
Passo a passo frontend ↔ backend e login/CORS: **[docs/ENV-SETUP.md](docs/ENV-SETUP.md)**.

## Requisitos

- Node.js **20+** para Clickora (`frontend` + `backend`); **22.12+** recomendado se fores correr `dpilotoaut`
- Docker Desktop (recomendado) **ou** PostgreSQL 14+ local

## Banco de dados (recomendado: Docker)

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe PostgreSQL em `localhost:5433` (usuário `clickora`, senha `clickora`, banco `clickora`).

Copie `backend/.env.example` para `backend/.env` e use:

```env
DATABASE_URL="postgresql://clickora:clickora@localhost:5433/clickora?schema=public"
FRONTEND_URL="http://localhost:8080"
```

Depois:

```bash
npm run api:db:migrate
npm run api:db:seed
```

Em **produção** (Railway / CI, sem prompts interactivos): `npm run api:db:migrate:deploy` — equivale a `prisma migrate deploy` no `backend`. Para alinhar dados dos planos após uma alteração ao seed, podes correr `npm run api:db:seed` na máquina que tenha `DATABASE_URL` correcto (atenção: o seed completo também recria/atualiza utilizadores de teste definidos em `seed.ts`).

### Usuários de teste (após o seed)

| Perfil | E-mail | Senha | Plano |
|--------|--------|-------|--------|
| Super Admin | `dclickora@gmail.com` | (ver `backend/prisma/seed.ts`) | Premium / anual (ilimitado) |
| Admin + Pro (mensal) | `adminpro@dclickora.com` | `pro123456` | Pro |
| Admin + Pro (anual) | `admin@dclickora.com` | `admin123456` | Premium |
| Utilizador (testes) | `daniel@gmail.com` | `daniel123456` | Pro |

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

### dpilotoaut (opcional — não necessário para `/tracking/dpilot` em produção)

Só se fores desenvolver ou comparar com o protótipo antigo. Variáveis: `dpilotoaut/.env.example`. Na raiz: `npm run dpiloto:dev`, `dpiloto:build`, etc.

O **deploy do site** continua a ser `npm run build` (API + `frontend`); não depende do build do `dpilotoaut`.

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
- `dpilotoaut`: TanStack Start + Vite 7 + React 19 (módulo satélite)

## Verificação após alterações (passo a passo)

Ordem sugerida para não regressar produção:

1. **Clickora (obrigatório antes de merge/deploy)**  
   - `cd backend && npm install && npm run build`  
   - `cd frontend && npm install && npm run build && npm run lint`  
   - Ou na raiz: `npm run build` e `npm run lint`

2. **dpilotoaut (só se alterares essa pasta)**  
   - `cd dpilotoaut && npm install && npm run lint && npm run build`

3. **E2E do frontend Clickora** (Playwright; requer browsers instalados):  
   - `cd frontend && npm run test:e2e`  
   - Ver `frontend/playwright.config.ts` (API + Vite de teste).

4. **Produção:** o pipeline habitual é `api:build` + `web:build`; o `dpilotoaut` não entra no artefacto do site.

## Observacoes

- Dependencias e arquivos de Lovable/Supabase foram removidos do frontend.
- O backend e totalmente baseado em Express + PostgreSQL.

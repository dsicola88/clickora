# dclickora

Aplicacao full-stack organizada em duas camadas:
- `frontend` em React + Vite + TypeScript
- `backend` em Node.js + Express + PostgreSQL (Prisma)

## Estrutura de pastas

- `frontend/src/`: interface web (frontend)
- `backend/src/`: API Express
- `backend/prisma/`: schema e seed do PostgreSQL
- `frontend/public/`: arquivos estaticos

## Deploy (produção)

Configuração Vercel + Railway, variáveis `VITE_PUBLIC_API_URL`, CORS e checklist: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.  
Passo a passo frontend ↔ backend e login/CORS: **[docs/ENV-SETUP.md](docs/ENV-SETUP.md)**.

## Requisitos

- Node.js 20+
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

### Usuários de teste (após o seed)

| Perfil | E-mail | Senha | Plano |
|--------|--------|-------|--------|
| Super Admin | `dclickora@gmail.com` | (ver `backend/prisma/seed.ts`) | Pro Anual (ilimitado) |
| Admin + Pro (mensal) | `adminpro@dclickora.com` | `pro123456` | Pro Mensal |
| Admin + Pro (anual) | `admin@dclickora.com` | `admin123456` | Pro Anual |
| Utilizador (testes) | `daniel@gmail.com` | `daniel123456` | Pro Mensal |

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
- React + Vite (cliente web)

## Observacoes

- Dependencias e arquivos de Lovable/Supabase foram removidos do frontend.
- O backend e totalmente baseado em Express + PostgreSQL.

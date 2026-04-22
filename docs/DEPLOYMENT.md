# Deploy (Vercel + Railway)

Arquitetura: **frontend estático** na Vercel (`dclickora.com`), **API Node** na Railway. O browser pode falar com a API de duas formas — escolhe **uma** e mantém-na documentada na equipa.

## 1. Variáveis do frontend (Vercel)

| Variável | Ambiente | Descrição |
|----------|----------|-----------|
| `VITE_PUBLIC_API_URL` | Production (recomendado) | URL HTTPS completa da API **com** sufixo `/api`, por exemplo `https://<serviço>.up.railway.app/api`. O build injeta no cliente; pedidos vão **diretos** à Railway (evita 502 por proxy). |
| *(vazio)* | Preview / opcional | Se não definires, o cliente usa `/api` no mesmo domínio — o `vercel.json` reescreve para a Railway. Útil para previews; em produção com tráfego real o proxy pode ser mais sensível a timeouts. |
| `VITE_API_URL` | Legado | Mesmo efeito que `VITE_PUBLIC_API_URL` se este estiver vazio. Preferir `VITE_PUBLIC_API_URL`. |

**Regra:** o host em `VITE_PUBLIC_API_URL` (sem `/api`) deve ser o **mesmo** serviço que o `destination` em `vercel.json` (ficheiros `vercel.json` na raiz e em `frontend/`, alinhados).

## 2. Variáveis da API (Railway)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | PostgreSQL (muitas vezes plugin Postgres na Railway). Preferir **Reference** ao serviço Postgres para `DATABASE_URL` ficar correcto na rede privada. |
| `DATABASE_URL_MIGRATE` | Opcional | Se `prisma migrate deploy` falhar com **P1001** para `postgres.railway.internal` no contentor, define esta variável com a **URL pública** do Postgres (Connect na Railway, host tipo `*.proxy.rlwy.net`) e `?sslmode=require`. Só as migrações usam este valor; a API continua com `DATABASE_URL`. |
| `JWT_SECRET` | Sim | Segredo para tokens. |
| `NODE_ENV` | Sim | `production`. |
| `FRONTEND_URL` | Sim (com API direta) | Origens do site, vírgula-separadas: `https://www.dclickora.com,https://dclickora.com`. Usado para CORS. Se o frontend chama a API noutro domínio (Railway), o CORS **tem** de incluir o origin do site. |
| `CORS_ALLOWED_ORIGINS` | Opcional | Origens extra (mesmo formato). |
| `API_PUBLIC_URL` | Recomendado | URL pública da API com `/api`, para links em e-mails e tracking. |

Sem `FRONTEND_URL` correto, o login e os pedidos com `Authorization` falham no browser por CORS quando a API é direta.

## 3. Base de dados

Na Railway, no arranque: `prisma migrate deploy` (já incluído em `start:prod` no `package.json` do backend).

## 4. Checklist após mudar URL da Railway

1. Atualizar `VITE_PUBLIC_API_URL` na Vercel (Production).
2. Atualizar `destination` em `vercel.json` (fallback do proxy `/api`).
3. Confirmar `FRONTEND_URL` / CORS na Railway.
4. Redeploy frontend e backend.

## 5. Verificação rápida

Do repositório:

```bash
./scripts/verify-production-api.sh
```

Esperado: `200` em `/api/health` (Railway e via `www`).

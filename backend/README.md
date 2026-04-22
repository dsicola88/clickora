# dclickora Backend

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

## Database

```bash
npx prisma migrate dev --name init   # Create tables
npx prisma db seed                    # Seed plans + admin user
npx prisma studio                     # Visual DB browser
```

## Run

```bash
npm run dev    # Development (hot reload)
npm run build  # Compile TypeScript
npm start      # Production
```

## Test users (seed)

| Role | Email | Password | Plan |
|------|-------|----------|------|
| Super Admin | dclickora@gmail.com | (see `prisma/seed.ts`) | Annual (unlimited) |
| Admin + Pro | adminpro@dclickora.com | pro123456 | Monthly (Pro) |
| Admin | admin@dclickora.com | admin123456 | Annual |
| User (testing) | daniel@gmail.com | daniel123456 | Monthly (Pro) |

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/login | ❌ | Login |
| POST | /api/auth/register | ❌ | Register |
| GET | /api/auth/me | ✅ | Current user |
| POST | /api/auth/reset-password | ❌ | Request reset |
| POST | /api/auth/update-password | ❌ | Update password |
| GET | /api/public/presells/id/:id | ❌ | Get public presell by id |
| GET | /api/public/presells/slug/:slug | ❌ | Get public presell by slug (domínio personalizado verificado) |
| GET | /api/presells | ✅ | List presells |
| POST | /api/presells | ✅ | Create presell |
| GET | /api/presells/:id | ✅ | Get presell |
| PUT | /api/presells/:id | ✅ | Update presell |
| DELETE | /api/presells/:id | ✅ | Delete presell |
| POST | /api/presells/:id/duplicate | ✅ | Duplicate presell |
| PATCH | /api/presells/:id/status | ✅ | Toggle status |
| GET | /api/analytics | ✅ | Summary by presell |
| GET | /api/analytics/events | ✅ | Event list |
| GET | /api/analytics/dashboard | ✅ | Dashboard metrics |
| GET | /api/plans | ❌ | List plans |
| POST | /api/plans/subscribe | ✅ | Subscribe to plan |
| POST | /api/plans/cancel | ✅ | Cancel subscription |
| POST | /api/webhooks/hotmart | ❌ | Hotmart payment webhook |
| POST | /api/track/click | ❌ | Track click |
| POST | /api/track/impression | ❌ | Track impression |
| POST | /api/track/event | ❌ | Track custom event |
| GET | /api/track/r/:presellId | ❌ | Redirect link with click tracking |
| GET | /api/track/pixel/:presellId.gif | ❌ | Impression pixel (1x1 gif) |
| POST | /api/track/postback/google-ads | ❌ | Receive Google Ads conversion postback |
| POST | /api/track/postback/microsoft-ads | ❌ | Receive Microsoft Ads conversion postback |
| GET | /api/track/postbacks/templates | ✅ | Get per-user postback URLs |
| GET | /api/track/postbacks/audit | ✅ | List recent postback processing logs |
| GET | /api/track/gclid/:gclid | ✅ | Lookup tracked GCLID data |
| GET | /api/admin/users | 🔒 | List all users |
| POST | /api/admin/users/:id/suspend | 🔒 | Suspend user |
| POST | /api/admin/users/:id/reactivate | 🔒 | Reactivate user |
| GET | /api/admin/metrics | 🔒 | Platform metrics |
| PATCH | /api/admin/users/:id/plan | 🔒 | Change user plan |

✅ = JWT required | 🔒 = JWT + admin role required

## Railway: erro Prisma **P3009** (migração falhada)

O Prisma bloqueia `migrate deploy` enquanto existir uma migração marcada como **falhada** na tabela `_prisma_migrations`. Tens de correr `migrate resolve` (ou limpar a linha com SQL) com o **nome exacto** que aparece no log, depois `migrate deploy` de novo.

### Typo na Railway: **`20240422120000_user_auto_blacklist_click_limit`**

Alguns logs mostram **`20240422`** (ano **2024**) em vez de **`20260422`** (2026). Esse nome **não existe** no repositório; só na tabela `_prisma_migrations` da base. Com `DATABASE_URL` público, na pasta **`backend/`**:

```bash
npm run db:migrate:resolve-rolled-back:auto-blacklist-railway-typo
npx prisma migrate deploy
```

Se o `resolve` falhar, executa o SQL em `scripts/delete-railway-typo-auto-blacklist-migration.sql` (via `psql` / TablePlus) e de seguida `npx prisma migrate deploy`.

### Migração **`20260422120000_user_auto_blacklist_click_limit`** (limite de cliques → blacklist)

Na pasta **`backend/`**, com `DATABASE_URL` apontando para o **mesmo Postgres** que o serviço Railway usa (URL **pública** / proxy se fores do teu PC; ver secção abaixo sobre `postgres.railway.internal`):

- **Atalho (recomendado):** com `DATABASE_URL` público no ficheiro `backend/railway.env` (uma linha, ver `railway.env.example`):
  ```bash
  cd backend
  npm run db:migrate:fix-railway-p3009:auto-blacklist
  ```
  Isto corre `migrate resolve --applied` e `migrate deploy`. Se o Prisma disser que não pode marcar como aplicada, usa a variante com `rolled-back`:
  ```bash
  npm run db:migrate:fix-railway-p3009:auto-blacklist -- rolled-back
  ```
- **À mão:** `npm run db:migrate:resolve-applied:auto-blacklist` (ou `resolve-rolled-back`) e depois `npx prisma migrate deploy`.

Depois **Redeploy** do serviço `clickora`.

---

Se o deploy parar com *failed migrations* na migração **`20260417130000_meta_capi_integration`** (Meta CAPI), o Prisma não aplica migrações novas até resolveres o estado.

**Nome errado só na base (Railway):** alguns logs mostram **`20240417130000_meta_copi_integration`** (ano `202404` e `meta_copi`). Esse nome **não existe** no repositório — foi typo / deploy antigo. Na pasta `backend/`, com `DATABASE_URL` da Railway:

```bash
npm run db:migrate:resolve-rolled-back:railway-typo-meta
npx prisma migrate deploy
```

(equivalente: `npx prisma migrate resolve --rolled-back "20240417130000_meta_copi_integration"`.) Se o `resolve` falhar porque esse nome **não existe** em `prisma/migrations/`, a Railway **não tem painel SQL integrado** no Postgres — usa uma destas formas para executar o SQL abaixo (faz backup se tens dúvida):

- **Railway CLI** (com `psql` instalado no Mac): na raiz do projecto ligado à Railway, `railway connect postgres` e cola o `DELETE` (ver [railway connect](https://docs.railway.com/cli/connect)).
- **`psql` com URL pública:** no serviço Postgres → **Variables** ou **Connect**, copia a URL **externa** (TCP proxy, muitas vezes com host `*.proxy.rlwy.net` ou parecido) e: `psql "COPIAR_DATABASE_URL_AQUI" -c "DELETE FROM ..."`
- **Cliente gráfico** (TablePlus, DBeaver, Postico): nova ligação Postgres com o host/porta/user/password das variáveis `PG*` ou `DATABASE_URL`.

SQL a correr:

```sql
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20240417130000_meta_copi_integration';
```

Depois `npx prisma migrate deploy` (local com a mesma URL, ou `railway run` a partir do repo) para aplicar a migração correcta **`20260417130000_meta_capi_integration`** do Git.

**Um comando (no teu PC):** com `DATABASE_URL` da Railway na variável de ambiente, na pasta `backend/`:

```bash
npm run db:migrate:fix-railway-p3009-typo
```

**Sem `export` na shell:** cria `backend/railway.env` (não vai para o git — copia de `railway.env.example`) com uma linha `DATABASE_URL="postgresql://..."` e corre:

```bash
cd backend
npm run db:migrate:railway-p3009
```

No **zsh**, não colas no terminal comentários com parênteses vindos de tutoriais — o zsh interpreta `( … )` como glob e responde `zsh: no matches found`.

**Da tua rede (casa / 4G):** o `DATABASE_URL` tem de ser o **TCP público** do Postgres na Railway (host tipo `*.proxy.rlwy.net`). URLs com **`postgres.railway.internal`** só funcionam **dentro** da Railway — o script `db:migrate:railway-p3009` recusa-as para evitar confusão. Teste de ligação: `npm run db:railway:check`.

Substitui **toda** a URL pela que o Railway mostra (uma linha só, com `postgres`, password, host e porta reais). **Não** uses texto de exemplo tipo `…PUBLICO…` — isso gera `P1001` com host estranho no erro.

O script tenta `migrate resolve`; se falhar, executa o SQL `scripts/delete-railway-typo-migration.sql` e de seguida `migrate deploy`.

Se o log mostrar **outro** nome, usa **exatamente** esse nome no `migrate resolve` ou no `DELETE`.

1. Liga o mesmo `DATABASE_URL` que o serviço usa (no Railway: Postgres → variável, ou `railway run`).
2. Na pasta **`backend/`**, corre **uma** destas sequências:

   - **Repetir a migração:** a BD não tem (ou não queres manter) o SQL desta migração.
     ```bash
     npm run db:migrate:resolve-rolled-back:meta-capi
     npx prisma migrate deploy
     ```
   - **Só alinhar o histórico:** as colunas `meta_*` já existem (por exemplo após `ALTER` manual ou o repair do seed), mas o Prisma ainda marca a migração como falhada.
     ```bash
     npm run db:migrate:resolve-applied:meta-capi
     npx prisma migrate deploy
     ```

3. Volta a fazer **Redeploy** do serviço `clickora`.

Mais detalhe: `sh scripts/railway-resolve-p3009-meta-capi.sh` (mensagens iguais às de cima).

## Hotmart setup

Fluxo (compra → acesso isolado):

1. Cliente compra na Hotmart → pagamento aprovado.
2. Hotmart envia POST para `POST /api/webhooks/hotmart` (com token, se configurado).
3. O backend valida o payload, mapeia produto/oferta → `Plan` interno, e faz **upsert** da assinatura.
4. **Novo e-mail** → cria **utilizador** (1 conta = 1 tenant: `workspaceId` + dados isolados por `userId`).
5. **Utilizador já existente** → só atualiza assinatura/plano.
6. Se for conta nova e **SMTP** estiver configurado (`SMTP_HOST`, `SMTP_FROM`, …), envia **e-mail de boas-vindas** com link de login (`FRONTEND_URL` ou `APP_PUBLIC_URL`) e **senha provisória** (recomenda-se alterar após o primeiro login).

Configuração:

1. Configure `HOTMART_WEBHOOK_TOKEN` in `.env`.
2. In Hotmart, set webhook URL to:
   - `https://YOUR_API_DOMAIN/api/webhooks/hotmart`
3. Send the same token in `x-hotmart-hottok`.
4. Configure plan mapping in `HOTMART_PLAN_MAP`:

```env
HOTMART_PLAN_MAP="{\"OFFER_MONTHLY\":\"monthly\",\"OFFER_ANNUAL\":\"annual\"}"
HOTMART_DEFAULT_PLAN_TYPE="monthly"
```

A resposta JSON pode incluir `user_created`, `welcome_email_sent` e `welcome_email_note` (se o e-mail não foi enviado, ex.: SMTP em falta).

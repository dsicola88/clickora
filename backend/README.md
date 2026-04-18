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

Se o deploy parar em `migrate deploy` com *failed migrations* na migração **`20260417130000_meta_capi_integration`** (Meta CAPI), o Prisma não aplica migrações novas até resolveres o estado. Se o log mostrar outro nome (ex. typo `202404...`), usa **exatamente** o nome que o Prisma imprimir no `migrate resolve`.

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

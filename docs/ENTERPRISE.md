# Enterprise — MFA, SSO OIDC, API keys, white-label

## MFA (TOTP)
- Setup: `POST /api/enterprise/mfa/setup` → `{ secret, otpauth_url }`
- Confirm: `POST /api/enterprise/mfa/confirm` `{ code }` → backup codes (uma vez)
- Login: se MFA activo, `POST /api/auth/login` devolve `{ mfa_required, mfa_token }` → `POST /api/auth/mfa/verify-login` `{ mfa_token, code }`
- Disable: `POST /api/enterprise/mfa/disable` `{ password, code }`

Env: `ENCRYPTION_KEY` (recomendado), `MFA_ISSUER` (opcional, default dclickora)

## SSO OIDC
Env obrigatório:
```
OIDC_ISSUER=https://your-idp.example.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=https://api.example.com/api/auth/oidc/callback
PUBLIC_APP_URL=https://www.dclickora.com
```
Fluxo: `GET /api/auth/oidc/login` → IdP → callback → redirect app `/auth#oidc_token=…`
Só entra se o e-mail já existir na BD (não cria contas).

## API keys B2B
- `GET/POST /api/enterprise/api-keys`, `DELETE /api/enterprise/api-keys/:id`
- Header: `Authorization: Bearer ck_live_…` (middleware `authenticateJwtOrApiKey` — aplicar nas rotas desejadas)

## White-label (Pro: has_branding=false)
- `GET/PUT /api/enterprise/branding/tenant` — brand_name, logo_url, favicon_url, cores, hide_powered_by
- Reflecte em `GET /api/public/presells/...` como `tenant_branding` + `footer_branding`

## Onboarding
- `GET /api/enterprise/onboarding/status` — checklist progress

## Domínio custom
- Requer `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` para SSL/hosting automático
- Verificar: `POST /api/custom-domain/:id/verify`

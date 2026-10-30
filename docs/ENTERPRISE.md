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

## API keys B2B (Public API v1)

Gestão (só sessão JWT na app — nunca com a própria API key):
- `GET/POST /api/enterprise/api-keys`, `DELETE /api/enterprise/api-keys/:id`

Uso:
- Header: `Authorization: Bearer ck_live_…`
- Scopes: `read` (GET/HEAD) · `write` (POST/PATCH/PUT/DELETE; inclui leitura)
- Resposta `403` com `code: api_key_scope_denied` se o scope faltar

Rotas com API key + scopes:
- `GET /api/analytics/*` (dashboard, funnel, conversions, …)
- `GET|POST|PATCH|DELETE /api/campaigns`
- `GET|POST|PATCH|DELETE /api/traffic-rotators`
- `GET|POST|PATCH|DELETE /api/presells`
- `GET|PUT /api/enterprise/branding/tenant`
- `GET /api/enterprise/onboarding/status`

Exemplo:
```bash
curl -sS -H "Authorization: Bearer ck_live_…" \
  "https://api.example.com/api/analytics/funnel?from=2026-10-01&to=2026-10-30"
```

## White-label (Pro: has_branding=false)
- `GET/PUT /api/enterprise/branding/tenant` — brand_name, logo_url, favicon_url, cores, hide_powered_by
- Reflecte em `GET /api/public/presells/...` como `tenant_branding` + `footer_branding`

## Onboarding
- `GET /api/enterprise/onboarding/status` — checklist progress

## Domínio custom
- Requer `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` para SSL/hosting automático
- Verificar: `POST /api/custom-domain/:id/verify`

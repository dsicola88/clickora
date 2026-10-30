# Segurança e isolamento multi-tenant — DClickora (Etapa 5)

**Branch:** `security/etapa5-isolamento`  
**Data:** 2026-10-30  

## 1. Correcções de código

| ID | Crit. | Correção |
|----|-------|----------|
| S3 | **P0** | Produção **recusa boot** sem `ENCRYPTION_KEY`; sem plaintext em `NODE_ENV=production` |
| A5 residual | **P1** | `USER_ID_MODELS` alargado (rotators, apiKey, compliance, branding, paidAdsProject, …) |
| SSRF landing | **P1** | `google-landing-extract` → `safeImportFetch` (pin de IP) |
| Paid defense | **P1** | `paidAdsProject.updateMany({ id, userId })` |
| Suite IDOR | **P1** | `security-isolation-suite.ts` com anti-produção + rotators/blacklist |

## 2. Script HTTP IDOR

```bash
LOAD_TEST_BASE_URL=http://127.0.0.1:3011 \
ALLOW_MUTATING_LOAD_TEST=1 \
LOAD_TEST_EMAIL=… LOAD_TEST_EMAIL_B=… LOAD_TEST_PASSWORD=… \
npm run test:security-isolation --prefix backend
```

**Nesta sessão:** E2E HTTP **não corrido** contra Railway (`.env` bloqueado de propósito). Postgres local instável.

## 3. Testes unitários

| Suite | Esperado |
|-------|----------|
| `fieldEncryption.prodGuard.test.ts` | PASS |
| `tenantPrisma.test.ts` | PASS |
| `loadTestSafety.test.ts` | PASS |

## 4. Produção

- [ ] `JWT_SECRET` ≥ 32 chars  
- [ ] `ENCRYPTION_KEY` válida (**obrigatória** após este commit)  
- [ ] Re-ligar OAuth paid se tokens legados em claro  

*Fim Etapa 5.*

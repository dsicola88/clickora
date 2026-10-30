# Fluxos funcionais — DClickora

Estado por fluxo na auditoria de **2026-10-30**, actualizado na **Etapa 6**.  
Índice: [INDICE_DOCUMENTACAO_DCLICKORA.md](./INDICE_DOCUMENTACAO_DCLICKORA.md).

Legenda:

| Estado | Significado |
|--------|-------------|
| **Testado e aprovado** | Executado nesta sessão (ou testes automatizados verdes) |
| **Testado e com falhas** | Executado e falhou |
| **Implementado, não testado** | Código/rotas existem; não corrido E2E aqui |
| **Parcial** | Parte coberta por unitários / scripts |
| **Bloqueado** | Falta BD local, API, Docker ou credenciais externas |

---

## 1. Registar conta

- **Código:** `POST /api/auth/register` (`auth.controller.ts`)
- **Estado:** Implementado, não testado (E2E HTTP nesta sessão)
- **Notas:** Seed cria users de teste; Playwright `login.spec.ts` existe

## 2. Login

- **Código:** `POST /api/auth/login` → JWT; MFA opcional
- **Estado:** Implementado, não testado runtime; unitários JWT/MFA parciais
- **Bloqueio:** API local down; `JWT_SECRET` ausente no `.env` local (dev usa `changeme`)

## 3–4. Escolher plano / activar assinatura

- **Código:** `GET/POST /api/plans`, webhook Hotmart
- **Estado:** Parcial — `subscription.hotmart.test.ts` **aprovado** (unit)
- **E2E pagamento real:** Bloqueado (credenciais Hotmart / não atacar produção)

## 5. Criar projecto (paid)

- **Código:** `POST /api/paid/projects`
- **Estado:** Implementado, não testado E2E
- **Gate:** assinatura activa + `dpilotAdsEnabled` (corrigido 2026-10-30)

## 6–8. Presell manual / automática / publicar

- **Código:** wizard + `presell.controller` + `assertPublishAllowed`
- **Estado:** Parcial — compliance unit/e2e-in-process **aprovados** em `npm run test:unit` (incl. `wizardPublish.e2e.test.ts`)
- **HTTP completo:** Bloqueado sem API+BD local; script `test:e2e-presell-flow` / Playwright disponíveis

## 9–11. Visitas / cliques / conversões

- **Código:** `/api/track/*`, analytics
- **Estado:** Parcial — `trackGuard`, `clickVisitorEvidence.e2e.test.ts`, `trackOfferRedirectGuard` **aprovados**
- **Load / concorrência:** Smoke health-only medido (Etapa 4); mutações em BD produção **bloqueadas** por safety — ver [TESTES_CARGA_DCLICKORA.md](./TESTES_CARGA_DCLICKORA.md). Re-correr mutações em Postgres `:5434` local.

## 12. Postbacks

- **Código:** track postback + Clickbank/JVZoo parsers
- **Estado:** Parcial — parsers unit **aprovados**
- **Integração rede real:** não simulada como real

## 13–15. Conectar Google / Meta / TikTok Ads

- **Código:** `paid/oauth.controller.ts`
- **Estado:** Implementado, não testado (precisa App IDs + redirect URLs)
- **Correcção:** tokens já **não** saem na API (`api-mappers`); escrita usa `storePaidToken`

## 16. Criar/gerir campanhas

- **Affiliate campaigns:** `/api/campaigns` — isolamento manual + `systemPrisma` (reforçado)
- **Paid campaigns:** `/api/paid/...` — unitários de bidding/RSA/optimizer **aprovados**
- **Publicação real em redes:** Bloqueado / não atacado

## 17. Relatórios

- **Código:** `analytics.controller.ts`, UI `Relatorios.tsx`
- **Estado:** Implementado, não testado HTTP; dashboard usa SQL agregado (evitar findMany gigante — comentário no código)

## 18–20. Alterar / cancelar / expirar assinatura

- **Código:** plans + webhook + `requireActiveSubscription` + `evaluateSubscriptionAccess`
- **Estado:** Parcial (Hotmart status unit); E2E bloqueios pós-expiração **não executados** nesta sessão

---

## Isolamento entre utilizadores

Relatório completo: [SEGURANCA_E_ISOLAMENTO.md](./SEGURANCA_E_ISOLAMENTO.md). Suite: `backend/scripts/security-isolation-suite.ts` (anti-produção).

| Área | Mecanismo | Teste |
|------|-----------|--------|
| Presells / public root | `userId` + owner do domínio | `test:presell-multitenant` — **PASS** (BD local `:5434`) |
| Tracking events | tenant Prisma + filtros | Unitários OK; analytics root HTTP **200** |
| Campanhas afiliado | filtros `userId` + `updateMany` ownership | IDOR GET/DELETE — **PASS** (404) quando suite corre em DB local |
| Paid projects | bootstrap + `userId` / `updateMany` | Gate plano **403**; list superadmin **200**; mutações cross-tenant rejeitadas no código |
| Tokens OAuth na API | redacção DTO + `tokenSecrets` | **PASS** (`api-mappers.secrets.test.ts`, `tokenSecrets.test.ts`) |
| SSRF destinos | `destinationProbe` / `safeImportFetch` | Pin IP + bloqueio privado (Etapa 5) |
| Boot secrets | JWT + `ENCRYPTION_KEY` em production | Falha de arranque se em falta |

---

## Diagrama do percurso cliente (alvo)

```
Registo → Login → Plano/Hotmart → Criar presell → Publicar
    → Tráfego (track) → Cliques/Conversões → Relatórios
    → (opcional) Dpilot: projecto → OAuth → Campanha → Optimizer
```

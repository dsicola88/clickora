# Auditoria final de produção — motor de conformidade

**Data:** 2026-10-15  
**Âmbito:** implementação real em `backend/src/compliance/`, gates de publicação, UI, SSRF, migração  
**Regra:** `ready_for_review` = verificações internas aplicáveis concluídas. **Não** é aprovação Google Ads / Microsoft Advertising.

---

## Resumo por área

| Área | Resultado | Notas |
|------|-----------|--------|
| Gates de publicação (create / PATCH status / update republicação) | **PASS** | Únicos caminhos que escrevem `published` passam por `assertPublishAllowed` |
| Bypasses de estado (PUT status, admin, lote) | **PASS** | PUT não aceita `status`; admin não publica; sem batch publish |
| Auth / tenant isolation | **PASS** | `billingUserId` + `denyIfCannotWritePresells`; audits/decisions filtrados por `userId`+`presellId` |
| Fingerprint / invalidação | **PASS*** | *corrigido nesta auditoria: `video_url` + disclosure/cookie no fingerprint |
| Overrides humanos | **PASS*** | *corrigido: só aplicáveis ao fingerprint da auditoria de origem |
| UI WARNING / NOT_CHECKED ≠ aprovado | **PASS*** | *corrigido: rótulo explícito com avisos + disclaimer |
| SSRF import | **PASS** | `presellImportSsrf` + `presellSafeFetch` com DNS pin |
| SSRF probe de conformidade | **FAIL** (residual) | Valida DNS por hop mas usa `fetch()` **sem** pin de IP (TOCTOU / rebinding). Import é mais forte |
| Rate limit auditoria | **PASS*** | *corrigido: `complianceAuditLimiter` (40/15min por conta) |
| Separação Google vs Microsoft | **PASS** (limitado) | Estrutura separada; a maioria das regras é partilhada; fontes MS EN parcialmente `unreachable` |
| Migração `20261015120000_presell_compliance_audits` | **PASS** (confirmado read-only) | `prisma migrate status` → schema up to date; coluna `compliance_gate` presente |
| Garantia de aprovação de ads | **N/A — correcto** | Produto não afirma aprovação oficial |

\* Inclui correções mínimas aplicadas nesta auditoria (sem nova migração).

---

## 1. Gates e bypasses

### Confirmado

| Caminho | Gate |
|---------|------|
| `POST /api/presells` com `status=published` | `assertPublishAllowed` — `presell.controller.ts` ~422–437 |
| `PATCH /api/presells/:id/status` → `published` | `assertPublishAllowed` — ~605–610 |
| `PUT /api/presells/:id` em página já `published` | Reauditoria; se falhar → `paused` — ~523–538 |
| `POST .../duplicate` | Sempre `draft` — ~579 |

Leituras públicas (`status: "published"` em `getPublicBySlug` / root host) **não** alteram estado.

### Sem bypass encontrado

- PUT não inclui `status` no `data`.
- Admin conta páginas; não força publish.
- Sem endpoint de publicação em lote.

---

## 2. Auditorias e versões

| Controlo | Estado |
|----------|--------|
| `contentFingerprint` no audit + página | Sim |
| Invalidação em content/settings/title/tracking/video_url | Sim (video_url corrigido nesta auditoria) |
| Reuso de audit de outra presell/user | Bloqueado por `where: { userId, presellId }` |
| Override após mudança de conteúdo | **Corrigido:** só aplica se `audit.contentFingerprint === fingerprint actual` |
| Override crítico → `needs_review` eterno | **Corrigido:** severity → `medium` após `override_pass` |
| WARNING/NOT_CHECKED como “aprovado” | UI mostra estado explícito + contagens; gate verde não diz “Approved” |

**Risco residual:** `deriveGate` permite `ready_for_review` com WARNING high/medium e NOT_CHECKED de destino. Intencional para o wizard, mas aumenta falsos negativos face a políticas de ads. Classificar como **incerto / revisão humana recomendada** antes de anunciar.

---

## 3. Segurança

| Controlo | Resultado |
|----------|-----------|
| SSRF localhost / metadata / privado (import + probe URL assert) | PASS (testes unitários) |
| Redirect hops revalidados (`assertExternalProductUrl` + DNS) | PASS no código do probe |
| DNS rebinding entre lookup e connect no **probe** | **FAIL residual** — ao contrário de `presellSafeFetch`, não faz pin de IP no socket |
| Timeout probe 8s | PASS |
| Limite de tamanho do corpo da probe | **Corrigido** (Range + cancel ~512KB) |
| Rate limit `compliance/audit` | **PASS*** — `complianceAuditLimiter` |
| GCLID/UTM | Probe local de merge; não cria open redirect; preserva params em teste sintético |
| Segredos em logs | PASS — erros de audit sem tokens/URLs com credenciais |

---

## 4. Testes executados (reais)

```
cd backend && node --import tsx --test \
  src/compliance/evaluate.test.ts \
  src/compliance/destinationProbe.test.ts \
  src/compliance/wizardPublish.e2e.test.ts
```

**Resultado:** 32 pass / 0 fail (antes das últimas micro-correções de fingerprint/UI; reexecutar após patch).

Cenários cobertos nos testes: ponte, conteúdo substantivo, claims, SSRF, redirects, tracking, override, Google/Microsoft structure, wizard publishable vs draft.

**Não executado nesta auditoria:** E2E Playwright contra `dclickora.com` produção; fuzz de DNS rebinding real; carga de rate limit.

---

## 5. Migração / produção

| Item | Confirmado? |
|------|-------------|
| `20261015120000_presell_compliance_audits` aplicada | **Sim** (`migrate status` → up to date) |
| Coluna `compliance_gate` | **Sim** |
| Backup antes desta auditoria | **Não verificado** — não se executaram migrações novas nesta auditoria |
| Deploy do código frontend/API com os patches desta auditoria | **Não verificado** — só código local |

Nenhuma migração nova foi executada nesta auditoria.

---

## 6. Falsos positivos / negativos relevantes

| Caso | Classificação |
|------|----------------|
| Página ponte imagem+nome+botão | Detetada (OC-001 FAIL) — OK |
| Falta afiliado/identidade | WARNING (não bloqueia) — **falso negativo operacional** face a misrepresentation |
| Espelho pesado sem copy própria | WARNING — **incerto**; Google Insufficient Original Content pode reprovar |
| Cloaking geo (`enterpriseCloak`) | FAIL DT-007 — possível **falso positivo** para uso legítimo de geo-safety |
| Fontes Microsoft EN unreachable | META-001 WARNING — política MS **incerta** |
| Override humano sem revalidar claim | Mitigado por fingerprint |

---

## 7. Correções mínimas aplicadas nesta auditoria

1. Overrides humanos limitados ao fingerprint da auditoria de origem (`service.ts`).
2. Override de FAIL crítico → WARNING `medium` (`evaluate.ts`).
3. Invalidação de gate em `video_url` (`presell.controller.ts`).
4. Fingerprint inclui `videoUrl`, cookie e disclosure (`extractPresellSignals.ts`).
5. UI: rótulo não trata avisos/NOT_CHECKED como “tudo limpo” (`PresellAdsCompliancePanel.tsx`).
6. Limite de corpo na probe (`destinationProbe.ts`).
7. Rate limiter em `POST .../compliance/audit` (`rateLimiters.ts` + `presell.routes.ts`).

## 8. Correções mínimas ainda pendentes (recomendadas)

1. **Pin de IP no probe** (reutilizar padrão `presellSafeFetch`) — prioridade segurança.
2. Rate limit também no `create`/`PATCH status` quando dispara probe (hoje só no endpoint `/audit`).
3. Opcional: `needs_review` automático quando `warningCount` de claims/original_content > 0 e categoria regulada.

---

## Veredicto

O motor **funciona como gate de publicação no servidor** nos caminhos principais e a migração de produção está aplicada.  
Há **riscos residuais reais** (probe sem DNS pin, ausência de rate limit, WARNINGs que não bloqueiam).  
**Não** declarar aprovação Google/Microsoft. Antes de anunciar: rever avisos humanos, destino HTTPS e divulgação na página pública.

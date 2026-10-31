# DCLICKORA — FASE 2: Sticky routing e A/B testing (E2E)

**Data:** 2026-10-31  
**Ambiente:** Postgres `127.0.0.1:55436/clickora_audit` · API gerida `http://127.0.0.1:3012` (`FASE2_API_MANAGED=1`)  
**Script:** `backend/scripts/e2e-sticky-ab-fase2.ts`  
**Log:** `.audit-fase-b-pg/fase2-sticky-ab.txt`  
**Cookie-jar (sessão browser-like):** `.audit-fase-b-pg/fase2-browser.jar`  
**Ledger canónico:** não alterado (Conversion continua fonte de receita; T10/T15 usam Conversion).

---

## 1. Arquitectura (auditoria)

| Peça | Implementação |
|------|----------------|
| Estratégias | `chooseEligibleArm` — `weighted` / `sequential` / `fill_order` (+ `random`) em `trafficRotator.service.ts` |
| Sticky | Cookie `clk_rs_{16hex}` · Max-Age **2592000** (30d) · só modos `weighted`\|`random` com `stickySession` |
| Persistência sticky | **Cookie do cliente** (não há tabela visitor↔arm). Reinício da API não apaga o cookie. |
| Estado DB | `sequence_cursor`, `clicks_delivered`, `sticky_session`, braços |
| Atribuição | `TrackingEvent.metadata.rotator_arm_id` → `Conversion.clickId` → `getRotatorAbStats` |
| Failover | `max_clicks` esgota braço → `backup_url` ou 503 |

---

## 2. Como reproduzir

```bash
cd backend
set -a && source .env.audit-fase-b && set +a
ALLOW_MUTATING_LOAD_TEST=1 FASE2_API_MANAGED=1 \
  LOAD_TEST_BASE_URL=http://127.0.0.1:3012 \
  npx tsx scripts/e2e-sticky-ab-fase2.ts
```

Tolerância weighted documentada: **±12 pp** vs peso esperado (`FASE2_WEIGHTED_TOL_PP`), N default **200**.

---

## 3. Resultados E2E reais (corrida 2026-10-31)

**summary: pass_ok=15/15 failed=0 managed=true**

| ID | Cenário | Resultado | Classificação | Evidência |
|----|---------|-----------|---------------|-----------|
| T01 | Primeiro acesso | PASS | **VALIDADO COM EVIDÊNCIA** | HTTP 302 `/path-a` + `Set-Cookie clk_rs_… Max-Age=2592000` |
| T02 | Segundo acesso mesmo cookie | PASS | **VALIDADO COM EVIDÊNCIA** | 1st=/path-a 2nd=/path-a |
| T03 | Novo acesso sem cookie | PASS | **VALIDADO COM EVIDÊNCIA** | 302 `/path-b` + novo cookie |
| T04 | Expiração do cookie | PASS | **VALIDADO COM EVIDÊNCIA** | Max-Age=2592000; sem cookie = novo pick. *Sem time-travel de relógio.* |
| T05 | Persistência após reinício API | PASS | **VALIDADO COM EVIDÊNCIA** | API SIGTERM+restart em :3012; sticky cookie → `/path-a` |
| T06 | Weighted amostra grande | PASS | **VALIDADO COM EVIDÊNCIA** | N=200 heavy=151 light=49 → **75.5%** (alvo 70% ±12pp) |
| T07 | Sequential | PASS | **VALIDADO COM EVIDÊNCIA** | `/s1,/s2,/s3,/s1,/s2,/s3` (cookie sticky ignorado) |
| T08 | fill_order | PASS | **VALIDADO COM EVIDÊNCIA** | 3×`/first` depois `/second` (max_clicks=3) |
| T09 | A/B variantes | PASS | **VALIDADO COM EVIDÊNCIA** | sticky→`/var-a`, meta `rotator_arm_label=VarA` |
| T10 | Conversão → variante | PASS | **VALIDADO COM EVIDÊNCIA** | Conversion + SQL sales=1 revenue=42.5 no braço; ab-stats 200 |
| T11 | Visitantes simultâneos | PASS | **VALIDADO COM EVIDÊNCIA** | 20 parallel redirects OK |
| T12 | Destino indisponível | PASS | **VALIDADO COM EVIDÊNCIA** | 1º `/only`; 2º backup `/fallback` após max_clicks |
| T13 | Falha tracking/redirect | PASS | **VALIDADO COM EVIDÊNCIA** *com limitação* | 404 id inválido; 404 `is_active=false`. *Fault-injection mid-Prisma create: não forçada.* |
| T14 | Isolamento contas | PASS | **VALIDADO COM EVIDÊNCIA** | GET rotator A como B → 404; 0 conv cruzadas. `/track/rot` público (esperado). |
| T15 | Eventos/conv/relatórios | PASS | **VALIDADO COM EVIDÊNCIA** | approved=1 revenue=42.5; TE clicks=1; externalOrder único |

### Sessão browser-like (cookie jar)

```
LOC1 → example.com/browser-b?clickora_click_id=…
LOC2 → example.com/browser-b?clickora_click_id=…   (mesmo destino)
clk_rs_c7603b806bc3417f=<arm uuid>
```

O browser embutido do IDE **não alcança** `127.0.0.1` (`chrome-error://chromewebdata/`). A prova de sessão sticky no “browser” foi feita com **cookie jar curl** (mesmo protocolo Cookie/Set-Cookie que o browser).

---

## 4. Critérios de aceitação

| Critério | Estado |
|----------|--------|
| Sticky mantém atribuição | **VALIDADO COM EVIDÊNCIA** (T01–T02, T05, cookie jar) |
| Sem troca inesperada de destino | **VALIDADO COM EVIDÊNCIA** (T02, T05) |
| Weighted dentro da tolerância | **VALIDADO COM EVIDÊNCIA** (T06, ±12pp) |
| Conversão na variante correcta | **VALIDADO COM EVIDÊNCIA** (T10) |
| Sem conversões duplicadas | **VALIDADO COM EVIDÊNCIA** (T15 unique externalOrder) |
| Falhas diagnosticáveis | **VALIDADO COM EVIDÊNCIA** (T12–T13 HTTP); mid-insert DB **IMPLEMENTADO MAS NÃO VALIDADO** |
| Sem fuga entre tenants | **VALIDADO COM EVIDÊNCIA** (T14) |

---

## 5. Limitações e riscos

1. **Sticky não está na BD** — limpar cookies = novo braço (by design).  
2. **Sequential sob race extrema** — cursor partilhado sem lock; T11 não prova ausência de race.  
3. **T04** valida Max-Age + comportamento sem cookie, não espera 30 dias reais.  
4. **Probe HTTP de destino** desligado no audit (`ROTATOR_DESTINATION_PROBE=0`) — failover por health **IMPLEMENTADO MAS NÃO VALIDADO** neste E2E (T12 usa max_clicks + backup).  
5. **Browser GUI** no IDE bloqueado a localhost; cookie jar cobre o contrato sticky.

---

## 6. Ficheiros

| Ficheiro | Papel |
|----------|-------|
| `backend/scripts/e2e-sticky-ab-fase2.ts` | E2E HTTP 15 cenários + reinício API |
| `backend/scripts/_fase2-browser-seed.ts` | Seed auxiliar cookie-jar |
| `backend/src/lib/trafficRotator.service.ts` | Pick + sticky name |
| `backend/src/controllers/track.controller.ts` | `rotatorRedirect` Set-Cookie |
| `backend/src/lib/rotatorAbStats.service.ts` | Stats A/B |

**npm:** `npm run test:e2e-sticky-ab-fase2` (ver `backend/package.json`).

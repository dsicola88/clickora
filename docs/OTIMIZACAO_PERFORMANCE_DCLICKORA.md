# Otimização de performance — DClickora (Fases 3–4)

**Data:** 2026-10-30  
**Ambiente:** API local `127.0.0.1:3001` + Postgres Docker `localhost:5434`  
**Regra:** VUs ≠ utilizadores humanos reais. Comparações só com métricas medidas nesta máquina (4 CPUs, ~8.6 GB RAM).  
**Segurança:** bcrypt cost **12** mantido; rate limit auth **80/15 min/IP** mantido; isolamento multi-tenant não alterado.  
**Fase 4 (memória / create):** [`DIAGNOSTICO_MEMORIA_DCLICKORA.md`](./DIAGNOSTICO_MEMORIA_DCLICKORA.md)

---

## 1. Causa raiz por gargalo

### 1.1 Login (Fase 2: p95 ~24 050 ms @ 50 VUs)

| Achado | Evidência |
|--------|-----------|
| `bcryptjs` corre no event loop / serializa sob concorrência | Microbench: 8 compares paralelos ≈ 8 seriais (~3.7 s) |
| Cost 12 intencional | Não reduzido |
| Consulta billing duplicada no login quando `tenantUserId === user.id` | Código em `auth.controller.ts` |
| Rate limit protege storms | 80 tentativas / 15 min / IP — esperado |

**Correção:** `passwordCrypto` com **bcrypt nativo** (`bcrypt` via libuv threadpool) + semáforo `min(4, CPUs)`; fallback `worker_threads` + `bcryptjs`; hash/compare unificados (auth, admin, webhook, MFA). Login evita 2.ª fetch de billing no caso owner.

**Microbench local:** `backend:native`, pool 4, 8 verifies — parallel **923 ms** vs serial **3074 ms** (speedup **3.33×**). Rounds = 12.

### 1.2 Analytics (Fase 2: ~4.3 % erros @ 250 VUs autenticados)

| Achado | Evidência |
|--------|-----------|
| Pool Prisma default (~CPUs×2+1) esgota sob burst | Erros 5xx/timeout sob 250 workers partilhando JWT |
| `getSummary` sem intervalo fazia full-scan por tenant | Query `GROUP BY` sem `created_at` por omissão |
| 3 queries sequenciais (events + 2 groupBy) | Código anterior |
| Índice `(user_id, created_at)` em falta | `EXPLAIN` usava só `user_id` ou o composto antigo |

**Correção:** `connection_limit` default 25 + `pool_timeout` 20 (sobrescrevível); default **90 dias** se não houver `from`/`to` (override `all=1`); `Promise.all` nas 3 queries; índice `tracking_events_user_id_created_at_idx`; 503 controlado em falha.

**EXPLAIN ANALYZE (local, tenant com poucos eventos):** execução &lt;1 ms; índice novo usado em all-time.

### 1.3 Criação de presells (Fase 2: p95 ~15 515 ms @ 500 VUs)

| Achado | Evidência |
|--------|-----------|
| Domínio + count + subscription + identidade em série | `presell.controller.create` |
| `reconcileMirror` no caminho crítico | No-op rápido se sem `importMirrorSrcDoc` longo (caso burst) |
| Contenção DB / RAM do host sob 500 creates | Latência sobe com VUs; mem livre cai para dezenas de MB |

**Correção:** paralelizar domínio + quota + `loadUserOperatorIdentity` com `Promise.all`. Sem remoção de funcionalidades.

---

## 2. Alterações realizadas (código)

| Área | Ficheiros |
|------|-----------|
| Password crypto | `backend/src/lib/passwordCrypto.ts`, `uvThreadpool.ts`, dep `bcrypt` |
| Auth / admin / webhook / MFA | controllers → `verifyPassword` / `hashPassword` |
| Prisma pool | `backend/src/lib/prisma.ts` (`databaseUrlWithPool`) |
| Analytics summary | `analytics.controller.ts` |
| Presell create | `presell.controller.ts` |
| Índice PG | migration `20261030120000_tracking_events_user_created_at_idx` |
| Observabilidade | `opsObservability.ts` — p50/p95/p99 por rota, event-loop lag, RSS/heap, slow requests, erros por rota (sem PII) |
| Testes | `passwordCrypto.test.ts`; `scripts/bench-password-crypto.ts` |

---

## 3. Testes antes vs depois

Mesmos scripts da Fase 2: `load-realistic-suite.ts` (login por VU) e `load-authed-burst.ts` (JWT partilhado — cenário explícito).

### 3.1 Realistic 50 VUs (com login por VU)

| Métrica | Fase 2 | Fase 3 | Veredicto |
|---------|--------|--------|-----------|
| erros | 0 | 0 | = |
| duração | 28.96 s | 12.05 s | melhor |
| RPS ops | 18.99 | 45.64 | melhor |
| **login p95** | **24 050 ms** | **11 565 ms** | **melhoria comprovada (~52 %)** |
| login avg | 23 859 ms | 6 686 ms | melhor |
| analytics p95 | 556 ms | 183 ms | melhor |
| presell_create p95 | 1 450 ms | 247 ms | melhor (carga menos sobreposta após login mais rápido) |

Login continua lento sob storm single-IP (CPU-bound bcrypt cost 12). **Não** se declara “login rápido”.

### 3.2 Burst autenticado (JWT partilhado)

| VUs | Fase 2 error_rate | Fase 3 error_rate | Nota |
|-----|-------------------|-------------------|------|
| 100 | 0 | **0** | OK |
| 250 | **0.0434** (analytics) | **0** | **erros analytics eliminados (comprovado)** |
| 500 | 0 | **0.0271** | regressão em erros (edit/track); create **0** erros |

#### p95 (ms) — burst

| Cenário | 100 F2 → F3 | 250 F2 → F3 | 500 F2 → F3 |
|---------|-------------|-------------|-------------|
| analytics | 963 → 4649 | 5171 → **2158** | 6679 → 4403 |
| presell_create | 2156 → 1885 | 4908 → 8854 | **15515 → 18095** |
| campaigns_list | 1371 → 1446 | 5707 → 2032 | 10973 → 17437 |

**Honestidade:**

- **Analytics @ 250:** melhoria comprovada em **taxa de erro** (4.3 % → 0). p95 analytics melhor vs F2 a 250.
- **presell_create @ 500:** p95 **não melhorou** (15.5 s → 18.1 s) — **não comprovado** como ganho; host com RAM livre muito baixa durante o teste.
- **500 VUs:** surgiram erros em `presell_edit` / track (ambiente saturado) — problema residual.

### 3.3 Observabilidade pós-carga (`GET /api/health` → `ops`)

Medido após bursts: `event_loop` p95 ~25 ms; RSS ~520 MB; `errors_5xx` 0 no processo; anéis de latência por rota normalizada.

---

## 4. Problemas ainda existentes

1. Login storm (50 VUs / mesmo IP): p95 ainda ~11.5 s — bcrypt cost 12 + 4 CPUs.
2. Rate limit 80/15 min continua a bloquear &gt;80 logins no mesmo IP (intencional).
3. Create/edit sob 500 VUs: latência alta; edit com erros nesta sessão.
4. Normalização de rotas no ring buffer por vezes colapsa paths de routers montados (`GET /`) — métricas úteis mas imperfectas.
5. 1000 VUs: **NÃO TESTADO**.
6. OAuth real: **NÃO TESTADO** nesta fase.

---

## 5. Limitações do ambiente de teste

- Um host laptop (4 CPUs, ~8.6 GB); RAM livre caiu para dezenas de MB sob 500 VUs.
- Um processo Node; rate limits e ops rings in-memory.
- Postgres Docker local, não produção Railway.
- Burst autentica com **um JWT partilhado** (cenário de stress de rotas, não N humanos).
- Realistic 100 VUs com login: não repetido após optimização (rate limit); veredicto F2 (429) mantém-se.

---

## 6. Como reproduzir

```bash
export UV_THREADPOOL_SIZE=8
export DATABASE_URL='postgresql://clickora:clickora@localhost:5434/clickora?schema=public'
export PRISMA_CONNECTION_LIMIT=25
# JWT_SECRET / ENCRYPTION_KEY / PORT=3001
node backend/dist/server.js

npx tsx backend/scripts/bench-password-crypto.ts
npx tsx backend/scripts/raise-local-plan-limits-for-load.ts
# realistic 50 / authed burst — mesmos env da Fase 2
```

---

## 7. Resumo executivo (Fase 3)

| Objectivo | Estado |
|-----------|--------|
| Reduzir latência de login sem baixar bcrypt | **Comprovado** (~24 s → ~11.5 s p95 @ 50) |
| Eliminar erros de analytics @ 250 | **Comprovado** (4.3 % → 0) |
| Reduzir p95 create @ 500 | **Não comprovado na Fase 3** (piorou 15.5 s → 18.1 s) |
| Observabilidade p50/p95/p99 + event loop | **Implementado** |
| Segurança / rate limit / isolamento | **Preservados** |

---

## 8. Fase 4 — Memória e create (actualização)

### Causa raiz

`void runPresellComplianceAudit(...)` após cada create draft gerava **até N audits Prisma em paralelo** (peak **491** @ 500 VUs create-only), saturando pool/CPU/RAM. Etapas HTTP dominantes: `db_insert`, `authz_write`, `domain/quota/identity` — todas DB-bound sob contenção. Mirror/imagens/geração ≈ 0 ms no payload de carga.

Redis: **inactivo**. PG Docker ~140 MiB. Host free frequentemente &lt;80 MB.

### Correção

Fila `complianceAuditQueue` (concurrency default **2**, queue **2000**). Métricas de etapas + GC/mem no `/api/health`.

### Create p95 — burst autenticado (comparável F2/F3/F4)

| VUs | F2 | F3 | **F4** |
|-----|----|----|--------|
| 100 | 2156 | 1885 | **1513** |
| 250 | 4908 | 8854 | **7000** |
| 500 | 15515 | 18095 | **4854** |

**Create @ 500: melhoria comprovada** (18.1 s → 4.9 s vs F3; também abaixo de F2).  
Create-only A/B no mesmo host: unbounded 11.3 s → queued 5.6 s p95 @ 500 (~−50 %).

### Ainda aberto

- `presell_edit` / track com alguns erros a 500 no burst completo.  
- Authz + quota continuam caros sob pico.  
- Fila atrasa audits (gate pode ficar `unchecked` até drenar).
---

## 9. Fase 5 — fila persistente

Ver [`ARQUITETURA_FILA_AUDITORIA.md`](./ARQUITETURA_FILA_AUDITORIA.md).  
Jobs em PostgreSQL + worker `SKIP LOCKED`; create reporta `audit_scheduled` / `audit_job_id`; sem drop silencioso; LEGACY bloqueado em produção.  
Create-only @250 após optimização enqueue: p95 **5649 ms** (F4B mem 2524 ms) — trade-off fiabilidade; jobs drenam (`completed_24h` > 0).

---

## Etapa 3 — A7–A11 (auditoria) — evidência 2026-10-30

Branch: `perf/etapa3-otimizacao`. Build frontend medido após correcções.

| ID | Antes | Depois (evidência) |
|----|-------|---------------------|
| A7 icons-vendor | ~779 kB | **chunk eliminado** — `dynamicIconImports` + sem `manualChunks` lucide |
| A8 DpilotPaidApp | ~320 kB monolítico | **~40 kB** shell; wizards/pages em chunks lazy (ex. Pages ~82 kB, GoogleWizard ~78 kB) |
| A8 Recharts | misturado | `charts-vendor` ~407 kB (partilhado só por rotas com gráficos) |
| A9 rate limit | só memória | Redis se `REDIS_URL`; senão memória; `consumeTrackRateLimitAsync` |
| A10 índices | em falta | migration `20261030150000_track_perf_indexes` (planId, user+created, IP+event, gclid/transaction_id expressions) |
| A11 CSV | N+1 por linha | batch SQL + `createMany` + increments por página |

Também incluído (gargalos medidos em carga local): `passwordCrypto` (bcrypt nativo/threadpool), pool Prisma default 25, analytics summary default 90 dias + Promise.all, índice `user_id+created_at`.

**Regra:** load tests continuam só em staging — nunca BD produção.

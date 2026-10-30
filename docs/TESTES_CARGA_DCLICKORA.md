# Testes de carga — DClickora (Etapa 4)

**Branch:** `load/etapa4-carga-staging`  
**Data:** 2026-10-30  
**Índice:** [INDICE_DOCUMENTACAO_DCLICKORA.md](./INDICE_DOCUMENTACAO_DCLICKORA.md).  
**Regra absoluta:** nunca contra BD/API de produção (Railway / dclickora.com).

---

## 1. Ambiente desta sessão

| Item | Estado |
|------|--------|
| Alvo HTTP medido | `http://127.0.0.1:3001` |
| `DATABASE_URL` em `backend/.env` | **Railway** (`gondola.proxy.rlwy.net`) — **bloqueado** para mutações |
| Postgres local `:5434` | Porta TCP aberta (Docker), mas **Prisma não consegue autenticar/ligar** nesta sessão (CLI Docker hung/instável) |
| API local `:3001` | `/api/health` = 200 |

**Consequência:** só foram executados testes **sem mutação** (`GET /api/health`). Suites autenticadas/criação de presells foram **recusadas de propósito** porque a BD configurada é produção.

---

## 2. Guardas anti-produção (implementadas)

| Script / módulo | Comportamento |
|-----------------|---------------|
| `scripts/lib/loadTestSafety.ts` | Bloqueia hosts Railway/rlwy/dclickora/vercel; mutações exigem `DATABASE_URL` localhost **e** `ALLOW_MUTATING_LOAD_TEST=1` |
| `load-smoke-safe.ts` | Só HTTP local/staging; health-only |
| `load-realistic-suite.ts` | Mutating → recusa se BD não for local |
| `load-authed-burst.ts` | Idem |
| `cleanup-load-test-data.ts` | Idem (não apaga dados em Railway) |
| `raise-local-plan-limits-for-load.ts` | Idem |

**Provas desta sessão:**

- `LOAD_TEST_BASE_URL=https://gondola.proxy.rlwy.net` → *Alvo bloqueado*
- `LOAD_TEST_BASE_URL=https://www.dclickora.com` → *Alvo bloqueado*
- `load-realistic-suite` / `load-authed-burst` / `raise-local-plan-limits` com `.env` Railway → *DATABASE_URL bloqueada… host=gondola.proxy.rlwy.net*

---

## 3. Resultados medidos (health-only)

Host do cliente de teste: máquina local do developer (não contentor Railway).

### 3.1 200 pedidos / concorrência 10

| Métrica | Valor |
|---------|-------|
| erros | **0** |
| RPS | **354.51** |
| latência avg / p50 / p95 / p99 (ms) | 25.92 / 21.13 / **59.35** / 79.62 |
| duração | 0.564 s |

### 3.2 500 pedidos / concorrência 50

| Métrica | Valor |
|---------|-------|
| erros | **0** |
| RPS | **413.84** |
| latência avg / p50 / p95 / p99 (ms) | 113.2 / 49.82 / **425.44** / 993.38 |
| duração | 1.208 s |

### 3.3 1000 pedidos / concorrência 50

| Métrica | Valor |
|---------|-------|
| erros | **0** |
| RPS | **459.22** |
| latência avg / p50 / p95 / p99 (ms) | 104.45 / 77.85 / **224.89** / 633.49 |
| duração | 2.178 s |

**Interpretação honesta:** a API responde bem a picos de health checks. Isto **não** prova suporte a N utilizadores a fazer login, criar presells, tracking ou ads.

---

## 4. Bloqueado nesta sessão (mutações / produto)

| Cenário | Estado | Motivo |
|---------|--------|--------|
| Login concorrente (50–1000 VUs) | **Não executado** | BD `.env` = Railway |
| Criar/editar/publicar presell sob carga | **Não executado** | Idem |
| Track impression/click sob carga | **Não executado** | Idem |
| Analytics autenticado sob carga | **Não executado** | Idem |
| Capacidade 1k / 5k / 10k users reais | **Não aprovado** | Sem métricas de fluxo autenticado em staging |

---

## 5. Como correr a suite completa em staging (checklist)

1. Postgres **dedicado** (ex. Docker Compose `localhost:5434`) — confirmar com:
   ```bash
   cd backend
   DATABASE_URL='postgresql://clickora:clickora@127.0.0.1:5434/clickora?schema=public' \
     npx tsx scripts/probe-local-db.ts
   ```
2. Apontar a API **só** a essa URL (nunca Railway):
   ```bash
   DATABASE_URL='postgresql://clickora:clickora@127.0.0.1:5434/clickora?schema=public' \
   JWT_SECRET='…≥32 chars…' ENCRYPTION_KEY='…' \
   PORT=3011 npx tsx src/server.ts
   ```
3. Migrate + seed na BD local.
4. Subir limites só na BD local:
   ```bash
   DATABASE_URL='…localhost:5434…' npx tsx scripts/raise-local-plan-limits-for-load.ts
   ```
5. Carga mutante:
   ```bash
   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 \
   ALLOW_MUTATING_LOAD_TEST=1 \
   LOAD_TEST_VUS=50 LOAD_TEST_ITERATIONS=2 \
   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
   npx tsx scripts/load-realistic-suite.ts
   ```
6. Burst autenticado (JWT partilhado):
   ```bash
   … npx tsx scripts/load-authed-burst.ts
   ```
7. Limpar lixo de teste:
   ```bash
   DATABASE_URL='…localhost…' npx tsx scripts/cleanup-load-test-data.ts
   ```

---

## 6. Aceitação Etapa 4

| Critério | Estado |
|----------|--------|
| Scripts de carga existem e medem p50/p95/p99/RPS/erros | **Sim** |
| Bloqueio de produção testado | **Sim** |
| Health load local com 0 erros | **Sim** (até 1000 req / c50) |
| Fluxos autenticados medidos em BD local | **Sim (addendum)** — Postgres Homebrew `:5435` + API `:3011`, 20 VUs |
| Declaração “suporta X users” | **Proibida** sem staging cloud + percentis datados a maior escala |

## 7. Addendum mutante local (2026-10-30)

Docker `:5434` continuou hung; usou-se cluster efémero `127.0.0.1:5435`.

| Suite | VUs | Erros | Notas |
|-------|-----|-------|-------|
| `load:realistic` | 20 | **0** | login p95 ~4159 ms; track/presell/public OK |
| `load:authed-burst` | 50 | 27% | quota `max_pages=25` em `presell_create` — esperado |

Detalhe e veredicto: [RELATORIO_ACEITACAO_FINAL_DCLICKORA.md](./RELATORIO_ACEITACAO_FINAL_DCLICKORA.md).

*Fim do relatório Etapa 4 (+ addendum).*

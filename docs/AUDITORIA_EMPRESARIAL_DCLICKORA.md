# Auditoria empresarial — DClickora

**Branch:** `audit/dclickora-diagnostico`  
**Etapa:** 1 — Auditoria e diagnóstico (**sem alterações de código de produto nesta branch**)  
**Data:** 2026-10-30  
**Âmbito:** repositório completo (frontend + backend + docs + scripts)  
**Regra:** apenas evidências; sem inventar capacidade de utilizadores nem benchmarks fictícios.

---

## Objectivos do programa (3 níveis)

| Nível | Meta |
|-------|------|
| **Performance** | Abrir rápido, navegar sem travamentos, processar cliques e conversões de forma fiável |
| **Escalabilidade** | Crescer utilizadores e volume de eventos sem comprometer dados |
| **Manutenção** | Qualquer programador competente compreender, instalar, testar, corrigir e continuar |

---

## Plano de trabalho (7 etapas)

| # | Etapa | Branch / ambiente | Estado |
|---|--------|-------------------|--------|
| 1 | Auditoria e diagnóstico, sem alterações | `audit/dclickora-diagnostico` | **Concluída** |
| 2 | Correção dos problemas P0 e P1 | `fix/p0-p1-seguranca-isolamento` | **Concluída** |
| 3 | Performance e otimização | `perf/etapa3-otimizacao` | **Concluída** (A7–A11 + login/analytics/pool) |
| 4 | Testes de carga | **staging apenas** — nunca BD/API de produção | Pendente |
| 5 | Segurança e isolamento | branch de security | Pendente (E2E IDOR, Redis rate-limit, etc.) |
| 6 | Documentação completa | docs nesta e branches seguintes | Rascunhos criados |
| 7 | Testes finais e relatório | staging + relatório de aceitação | Pendente |

**Regra crítica:** testes de carga e scripts destrutivos **só em staging** com Postgres próprio. Hosts Railway / `DATABASE_URL` de produção devem ser **bloqueados** pelos scripts de carga.

---

## 1. Estado geral do projecto

O DClickora é um **monólito SaaS** (React/Vite + Express/Prisma/PostgreSQL) com três pilares no **mesmo login**:

1. Presells  
2. Tracking / relatórios  
3. Anúncios pagos (UI histórica `/tracking/dpilot`, API `/api/paid`)

**Não está declarado “pronto para milhares de utilizadores simultâneos”.**  
Nesta etapa de diagnóstico, load tests de produto completo **não** foram aprovados como prova de escala (ver §8).

**Baseline de testes no código de `main` (referência de sessão):**

| Suite | Resultado observado |
|-------|---------------------|
| `backend` `npm run test:unit` | PASS (centenas de testes) |
| `backend` `npm run test:paid` | PASS |
| `backend` `tsc --noEmit` | exit 0 |
| `frontend` `npm run build` | exit 0 (~5m27s) |

---

## 2. Arquitetura identificada

Ver **[ARQUITETURA_DCLICKORA.md](./ARQUITETURA_DCLICKORA.md)**.

Resumo:

- Entrada única `backend/src/server.ts`
- Tenant ALS + Prisma extension (`tenantPrisma.ts`)
- Dpiloto externo/SSO/iframe: **removido**; resta naming + CORS legado
- Duas stacks Google Ads (afiliado vs paid)

Fluxos: **[FLUXOS_FUNCIONAIS_DCLICKORA.md](./FLUXOS_FUNCIONAIS_DCLICKORA.md)**.  
Onboarding técnico: **[GUIA_DESENVOLVEDOR_DCLICKORA.md](./GUIA_DESENVOLVEDOR_DCLICKORA.md)**.  
Env: **[VARIAVEIS_AMBIENTE_DCLICKORA.md](./VARIAVEIS_AMBIENTE_DCLICKORA.md)**.

---

## 3. Funcionalidades efectivamente testadas (diagnóstico)

### Coberto por testes automatizados existentes

- Tracking guards, postback parsers, compliance, subscription Hotmart, optimizer, creatives (unit)
- Compilação TypeScript backend
- Build de produção frontend (tamanhos — §7)

### Bloqueado / não aprovado nesta etapa como prova de produto

- Load completo autenticado (login, presells, postbacks, relatórios sob concorrência)
- Core Web Vitals em browser real
- Playwright suite completa dos fluxos HTTP
- Mutações/carga contra qualquer host de produção (propositadamente recusado)

### Risco operacional observado

- `.env` local pode apontar `DATABASE_URL` para Railway → risco de misturar dev com produção (A6)

---

## 4. Problemas encontrados

| ID | Crit. | Área | Problema | Evidência |
|----|-------|------|----------|-----------|
| A1 | **P0** | Segurança | API paid pode expor refs OAuth (`token_ref` / `refresh_token_ref`) em claro ao cliente | `paid/api-mappers.ts`; frontend não consome — risco DevTools/rede/XSS |
| A2 | **P0** | Segurança | Tokens paid gravados sem o mesmo padrão de `encryptSecretField` das integrações afiliado | `oauth.controller.ts` vs `fieldEncryption` afiliado |
| A3 | **P0** | Segurança | `JWT_SECRET \|\| "changeme"` permite boot fraco se env falhar | `lib/jwt.ts` |
| A4 | **P1** | Billing/Auth | `/api/paid` com gate de plano mas sem `requireActiveSubscription` alinhado ao resto | `paid.routes.ts` |
| A5 | **P1** | Multitenancy | `affiliateCampaign` fora de `USER_ID_MODELS`; delete/update por `id` no cliente tenant | `tenantPrisma.ts`, `campaigns.controller.ts` |
| A6 | **P1** | Ops | Dev local sem secrets fortes; `DATABASE_URL` pode ser produção | inspeção env (sem dump) |
| A7 | **P2** | Performance | Chunk `icons-vendor` ~779 kB (gzip ~136 kB); aviso Vite >500 kB | **Corrigido** Etapa 3 — `dynamicIconImports` + sem manualChunk lucide |
| A8 | **P2** | Performance | Chunks pesados: Recharts / Dpilot monolítico | **Corrigido** Etapa 3 — `charts-vendor` + lazy nested Dpilot |
| A9 | **P2** | Performance | Rate limit track só em memória (fraco com N instâncias) | **Corrigido** Etapa 3 — Redis se `REDIS_URL`, senão memória |
| A10 | **P2** | DB | Índices candidatos em falta (`Subscription.planId`, IP+event, gclid) | **Corrigido** Etapa 3 — migration `20261030150000_track_perf_indexes` |
| A11 | **P2** | DB | `conversionsCsv` N+1 por linha | **Corrigido** Etapa 3 — batch SQL + createMany |
| A12 | **P2** | Arquitectura | Duas OAuth Google (integrations vs paid) | `modules/googleAds` e `paid/` |
| A13 | **P3** | Legado | `DPILOTO_PUBLIC_ORIGINS`, rotas `*-legacy` | server + App.tsx |
| A14 | **P1** | Compliance | Probe SSRF sem pin de IP (já documentado) | `docs/compliance/PRODUCTION_AUDIT_2026-10-15.md` |
| A15 | **P2** | Escala | Sem Redis; caches/rate-limit process-local | deps |

---

## 5. Correções Etapa 2 (P0/P1) — `fix/p0-p1-seguranca-isolamento`

| ID | Estado | Correção | Ficheiros |
|----|--------|----------|-----------|
| A1 | **Corrigido** | DTOs com `has_token` / `oauth_pending`; `token_ref` sempre `null` | `paid/api-mappers.ts`, `api-mappers.secrets.test.ts` |
| A2 | **Corrigido** | `storePaidToken` / `loadPaidToken` (AES via `ENCRYPTION_KEY`) | `tokenSecrets.ts` + OAuth/publish/mutations |
| A3 | **Corrigido** | Produção rejeita JWT fraco/ausente no boot | `lib/jwt.ts` |
| A4 | **Corrigido** | `requireActiveSubscription` no router paid | `paid.routes.ts` |
| A5 | **Corrigido** | `affiliateCampaign` em `USER_ID_MODELS`; ops via `systemPrisma` + `userId` | `tenantPrisma.ts`, `campaigns.controller.ts` |
| A6 | **Mitigado** | Postgres local `:5434`; `.env.example` + README; script anti-produção | `docker-compose.yml`, `.env.example`, `load-smoke-safe.ts` |
| A14 | **Corrigido** | Probe de conformidade com pin de IP (mesmo padrão que import) | `compliance/destinationProbe.ts` |

**Nota:** tokens **já existentes** em plaintext na BD continuam legíveis via `decryptSecretField` (legado sem prefixo `d1:`). Novas ligações OAuth encriptam **se** `ENCRYPTION_KEY` estiver definida. Re-ligar contas após definir a chave em produção.

---

## 6. Testes de referência (diagnóstico)

| Teste | Resultado / nota |
|-------|------------------|
| Unit / paid / tsc / frontend build | PASS na linha de base da sessão |
| Load contra host Railway | **Deve ser recusado** (política) |
| Load produto em staging | **Pendente Etapa 4** |
| `test:presell-multitenant` | Requer Postgres **local/staging**, nunca produção |
| Playwright E2E fluxos 1–20 | Pendente Etapas 5–7 |
| Ataques a APIs Google/Meta/TikTok | Fora de âmbito |

---

## 7. Performance medida (build estático)

Comando: `cd frontend && npm run build` (sessão 2026-10-30).

| Asset (exemplos) | Tamanho | Gzip |
|------------------|---------|------|
| `icons-vendor-*.js` | 779.20 kB | 136.13 kB |
| Recharts chunk | ~372 kB | ~103 kB |
| `DpilotPaidApp-*.js` | ~320 kB | ~83 kB |
| Landing sections | ~277 kB | ~83 kB |
| `PageEditor-*.js` | ~248 kB | ~61 kB |
| `react-vendor-*.js` | ~213 kB | ~68 kB |

**Positivo:** `lazy()` em `App.tsx`; `manualChunks` em Vite.  
**Core Web Vitals:** não medidos nesta etapa.  
**Backend runtime:** sem profiling de endpoints autenticados como prova de Etapa 1.

---

## 8. Capacidade de carga

| Cenário | Estado |
|---------|--------|
| 100 / 500 / 1k / 5k / 10k users simultâneos | **Não testado** — Etapa 4 em staging |
| Login / presells / postbacks / relatórios concorrentes | **Não testado** |
| Protecção anti-alvo produção nos scripts | **Obrigatória** antes de qualquer smoke |

### Gargalos previstos (análise estática, não medição)

1. PostgreSQL single-instance + analytics pesadas  
2. Rate limit / caches só por processo  
3. Limites externos OAuth/publish  
4. Chunks JS grandes (icons, charts, dpilot)  
5. CSV import N+1  
6. Jobs pesados majoritariamente in-process  

---

## 9. Segurança e isolamento (estado em `main`)

| Controlo | Estado no diagnóstico |
|----------|------------------------|
| JWT + tenant ALS | Presente; A3 = risco se secret fraco |
| Tokens paid na API | A1 aberto |
| Tokens paid em repouso | A2 aberto |
| Tokens integrações afiliado | Já usavam encriptação de campo |
| Isolamento paid | Ownership por `project.userId` — E2E IDOR pendente |
| Isolamento campanhas afiliado | A5 aberto |
| Webhooks Hotmart | Assinatura no código; runtime E2E pendente |
| SSRF import | Unitários; A14 residual |
| Admin | `requireRole` + `prismaAdmin` |
| CORS / helmet | Presentes |

---

## 10. UX / UI (estático)

| Observação | Severidade |
|------------|------------|
| Sidebar + command palette | Positivo |
| Lazy loading generalizado | Positivo |
| Navegação densa para iniciantes | P3 |
| Rotas `*-legacy` | P3 |
| Chunks grandes → percepção mobile | P2 (A7/A8) |

---

## 11. Documentação

| Doc | Papel |
|-----|--------|
| README, DEPLOYMENT, ENV-SETUP, PAID-ADS, ENTERPRISE, POSTGRES-BACKUP | Existentes |
| Esta AUDITORIA + ARQUITETURA + FLUXOS + GUIA + VARIAVEIS | Entrega Etapa 1 / rascunho Etapa 6 |

---

## 12. Dívida técnica (pós P0/P1)

1. Unificar ou documentar as duas stacks Google Ads  
2. Completar cobertura tenant / `systemPrisma`  
3. Rate limit partilhado (Redis/CDN) se houver réplicas  
4. Reduzir `icons-vendor`  
5. Batch `conversionsCsv` + índices DB  
6. Playwright + multitenant em staging  
7. `ENCRYPTION_KEY` + `JWT_SECRET` em todos os ambientes  
8. Separar `.env` local de produção (A6)

---

## 13. Checklist produção / staging

- [ ] `JWT_SECRET` forte em produção (bloqueia A3)  
- [ ] `ENCRYPTION_KEY` + re-OAuth paid após A2  
- [ ] Dev **nunca** aponta mutações para BD produção  
- [ ] Staging com Postgres próprio para Etapa 4  
- [ ] R2, Hotmart, OAuth — ver `VARIAVEIS_AMBIENTE_DCLICKORA.md`  
- [ ] Monitorização + backups (`POSTGRES-BACKUP.md`)

---

## 14. Recomendações prioritárias

1. **Agora:** publicar esta branch; abrir Etapa 2 (P0 A1–A3, P1 A4–A6/A14).  
2. **Antes de escala:** staging + load scripts com bloqueio de produção.  
3. **Etapa 3:** icons/charts, índices, batch CSV.  
4. **Etapas 5–7:** E2E isolamento, docs finais, relatório com percentis.  
5. **Não declarar** capacidade 1k–10k users sem relatório de carga datado em staging.

---

## Tabela de aceitação (diagnóstico)

| Área | Estado | Evidência |
|------|--------|-----------|
| Performance | **Parcial** — build medido; runtime/CWV não | build frontend |
| Escalabilidade | **Não aprovado** | sem carga staging |
| Segurança | **Riscos P0/P1 abertos** | §4 A1–A6, A14 |
| Presells / Tracking / Paid / Billing | **Parcial** | unitários; E2E produto pendente |
| Base de dados | **Parcial** | schema revisto; carga/migração staging pendente |
| Documentação | **Melhorada nesta branch** | 5 docs |
| Produção | **Não declarado pronto** | checklist §13 |

---

*Fim do relatório de Etapa 1. Afirmações futuras de “suporta X utilizadores” devem citar relatório de carga com data, ambiente staging e percentis medidos.*

# Índice da documentação — DClickora

**Data:** 2026-10-30  
**Objectivo de manutenção:** qualquer programador competente instalar, testar, corrigir e continuar o desenvolvimento sem depender do autor original.

---

## Por onde começar

| Se precisas de… | Abre |
|-----------------|------|
| Instalar e correr local | [GUIA_DESENVOLVEDOR_DCLICKORA.md](./GUIA_DESENVOLVEDOR_DCLICKORA.md) |
| Mapa do sistema | [ARQUITETURA_DCLICKORA.md](./ARQUITETURA_DCLICKORA.md) |
| Variáveis de ambiente | [VARIAVEIS_AMBIENTE_DCLICKORA.md](./VARIAVEIS_AMBIENTE_DCLICKORA.md) + `backend/.env.example` |
| Deploy Vercel + Railway | [DEPLOYMENT.md](./DEPLOYMENT.md) + [ENV-SETUP.md](./ENV-SETUP.md) |
| Diagnóstico / P0–P3 | [AUDITORIA_EMPRESARIAL_DCLICKORA.md](./AUDITORIA_EMPRESARIAL_DCLICKORA.md) |
| Performance medida | [OTIMIZACAO_PERFORMANCE_DCLICKORA.md](./OTIMIZACAO_PERFORMANCE_DCLICKORA.md) |
| Carga (staging only) | [TESTES_CARGA_DCLICKORA.md](./TESTES_CARGA_DCLICKORA.md) |
| Segurança / IDOR | [SEGURANCA_E_ISOLAMENTO.md](./SEGURANCA_E_ISOLAMENTO.md) |
| Fluxos de produto | [FLUXOS_FUNCIONAIS_DCLICKORA.md](./FLUXOS_FUNCIONAIS_DCLICKORA.md) |
| Anúncios pagos | [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md) |
| Readiness mundial (ledger, sticky, i18n, gaps) | [WORLD_CLASS_READINESS_DCLICKORA.md](./WORLD_CLASS_READINESS_DCLICKORA.md) |
| Auditoria E2E A→J | [AUDITORIA_MASTER_END_TO_END_DCLICKORA.md](./AUDITORIA_MASTER_END_TO_END_DCLICKORA.md) |
| Backups Postgres | [POSTGRES-BACKUP.md](./POSTGRES-BACKUP.md) |
| Imagens / R2 | [IMAGENS-E-ARMAZENAMENTO.md](./IMAGENS-E-ARMAZENAMENTO.md) |

---

## Programa de hardening (7 etapas)

| # | Etapa | Branch típica | Doc de entrega |
|---|--------|---------------|----------------|
| 1 | Auditoria (sem código) | `audit/dclickora-diagnostico` | `AUDITORIA_EMPRESARIAL_DCLICKORA.md` |
| 2 | P0/P1 segurança | `fix/p0-p1-seguranca-isolamento` | §5 da auditoria |
| 3 | Performance | `perf/etapa3-otimizacao` | `OTIMIZACAO_PERFORMANCE_DCLICKORA.md` |
| 4 | Carga (nunca produção) | `load/etapa4-carga-staging` | `TESTES_CARGA_DCLICKORA.md` |
| 5 | Isolamento / IDOR | `security/etapa5-isolamento` | `SEGURANCA_E_ISOLAMENTO.md` |
| 6 | Documentação completa | `docs/etapa6-documentacao-completa` | **este índice** |
| 7 | Testes finais + relatório | `report/etapa7-aceitacao-final` | [RELATORIO_ACEITACAO_FINAL_DCLICKORA.md](./RELATORIO_ACEITACAO_FINAL_DCLICKORA.md) |

**Regra transversal:** scripts `load-*` e `security-isolation-suite` **recusam** Railway / `dclickora.com` e mutações sem `DATABASE_URL` localhost + `ALLOW_MUTATING_LOAD_TEST=1`.

---

## Comandos essenciais

```bash
# Dev
npm install && npm --prefix backend install && npm --prefix frontend install
docker compose up -d   # Postgres :5434
cp backend/.env.example backend/.env   # DATABASE_URL local — NÃO Railway
npm run api:db:migrate && npm run api:db:seed
npm run dev

# Qualidade
cd backend && npm run test:unit && npm run test:paid && npx tsc --noEmit
cd frontend && npm run build

# Segurança / carga (só staging/local)
cd backend && npm run test:load-safety
LOAD_TEST_BASE_URL=http://127.0.0.1:3001 npm run load:smoke
# Mutações: ver TESTES_CARGA + SEGURANCA_E_ISOLAMENTO
```

---

## Documentação por domínio

| Domínio | Docs |
|---------|------|
| Auth / planos / Hotmart | GUIA §6, `PAGAMENTOS-ANGOLA.md`, `subscription.hotmart.test.ts` |
| Presells / compliance | GUIA §6, `docs/compliance/` |
| Tracking / SLO | GUIA §6, `TRACKING-SLO.md`, `METRICAS-HONESTAS.md` |
| Paid ads | `PAID-ADS-ARCHITECTURE.md`, `PAID-AUTOPILOT-PRODUCT-ROADMAP.md` |
| Enterprise / OIDC | `ENTERPRISE.md` |
| Afiliado | `AFILIADO-PROFISSIONAL.md` |

---

## Critério de “documentação completa” (Etapa 6)

- [x] Índice único de entrada  
- [x] Arquitectura actualizada (tenant, paid, Redis opcional, boot secrets)  
- [x] Guia com instalação, testes, regras de alteração  
- [x] Variáveis com prod obrigatórias (`JWT_SECRET`, `ENCRYPTION_KEY`) e carga  
- [x] Fluxos com estados honestos  
- [x] Relatórios de auditoria / perf / carga / segurança linkados  
- [x] README raiz aponta para este índice  

*Manter este ficheiro como mapa; não duplicar conteúdo longo aqui.*

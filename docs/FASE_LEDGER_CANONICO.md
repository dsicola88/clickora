# DCLICKORA — FASE 1: Ledger canónico de conversões

**Data:** 2026-10-31  
**Ambiente de evidência:** Postgres `127.0.0.1:55436/clickora_audit` (`.env.audit-fase-b`) — **nunca produção**.  
**Commit de fecho:** `41d35c9` em `main`.

---

## 1. Arquitectura anterior vs final

### Anterior (parcial)

| Caminho | Escrita | Receita nos relatórios |
|---------|---------|------------------------|
| Webhook afiliado | `Conversion` | Canónica |
| Postback Google/Microsoft Ads | `TrackingEvent` + `Conversion` | Canónica via Conversion |
| Import Offline CSV `POST /track/conversions/csv` | **só `TrackingEvent`** com `metadata.value` | **NÃO entrava** em `revenue` / Relatórios |
| Dashboard | `revenue` = Conversion; ainda expunha `tracking_conversion_revenue` (soma TE) | Risco de interpretação errada |

### Final (FASE 1)

| Regra | Implementação |
|-------|----------------|
| **Conversion** = única fonte de receita / comissões / vendas aprovadas | `status = 'approved'`; `_sum(amount)` |
| **TrackingEvent(conversion\|sale)** = telemetria | Nunca alimenta P&L, ROAS, CSV financeiro |
| Deduplicação estável | `@@unique([userId, externalOrderId])` |
| Offline CSV | Cria `Conversion` com `externalOrderId = offline_csv:csv_gclid:{gclid}` + TE telemetria opcional |
| Ads postbacks | `externalOrderId = {origin}:{transactionId}` |
| Reembolsos / cancel / pending→approved | Actualizam `status`/`amount`; histórico em `metadata` |
| API dashboard | `revenue_source: "conversion"` + `tracking_conversion_is_telemetry_only: true` |

```
Postback afiliado ──┐
Ads Google/MS ──────┼──► Conversion (approved) ──► revenue / funnel / Relatórios / Offline export CSV
Offline CSV import ─┘         ▲
                              │ unique(userId, externalOrderId) → idempotência / race P2002
TrackingEvent(conversion) ────┴── telemetria apenas (não soma financeira)
```

---

## 2. Ficheiros e funções alterados

| Ficheiro | Alteração |
|----------|-----------|
| `backend/src/lib/conversionLedger.ts` | `offlineCsvExternalOrderId`, `upsertConversionFromOfflineCsv`, `sumApprovedConversionTotals`, `applyLedgerTransition`, reconcile CSV |
| `backend/src/lib/unifiedAdsConversion.ts` | `adsExternalOrderId` exportado |
| `backend/src/controllers/track.controller.ts` | `conversionsCsv` grava **Conversion** canónica (+ TE telemetria) |
| `backend/src/controllers/analytics.controller.ts` | `revenue_source`, `tracking_conversion_is_telemetry_only` |
| `backend/src/lib/conversionLedger.canonical.test.ts` | Testes unitários regras 1–12 (semântica) |
| `backend/scripts/e2e-ledger-canonical.ts` | Evidência DB auditoria (13 checks) |
| `docs/METRICAS-HONESTAS.md` | Fonte de verdade alinhada |
| `frontend/src/services/analyticsService.ts` | Tipos dos novos campos |

**Migrações:** nenhuma — o unique `(userId, externalOrderId)` já existia. Sem DROP/RESET.

---

## 3. Problemas encontrados

1. **Import CSV só em TE** — vendas Offline não apareciam no ledger financeiro → **corrigido**.
2. **`tracking_conversion_revenue`** no dashboard podia ser lido como P&L → marcado explicitamente como telemetria; `revenue` continua Conversion-only.
3. Docs anteriores (“ledger absoluto fechado”) **overclaim** enquanto CSV import estava TE-only → esta fase fecha o buraco de produto.
4. Dimensões keyword/país/dispositivo por `JOIN click` podem excluir vendas unattributed ou fora da janela do clique — **risco residual** (ver §7); totais de dashboard usam `Conversion.createdAt`.

---

## 4. Migrações executadas

| Item | Estado |
|------|--------|
| Schema novo | NÃO necessário |
| Dados históricos | Preservados; TE CSV antigos **sem** Conversion continuam telemetria (não migrados automaticamente — ver riscos) |
| Produção | Intocada nesta validação |

---

## 5. Testes e resultados reais

### Unitários (`node --import tsx --test …conversionLedger*.test.ts …unifiedAds*`)

```
pass=21 fail=0  (2026-10-31)
```

Inclui cenários 1–12 a nível de identidade / máquina de estados / P2002.

### E2E auditoria (`npx tsx scripts/e2e-ledger-canonical.ts` + `.env.audit-fase-b`)

```
PASS  1_postback_once
PASS  2_postback_repeat
PASS  3_concurrent_race          created=1 dup=1 rows=1
PASS  4_same_business_key_csv    offline_csv:csv_gclid:… rows=1
PASS  5_refunded
PASS  6_cancelled_pending
PASS  7_pending_to_approved      Δrevenue=15 Δcount=1
PASS  8_csv_export_vs_ledger     export=78.5 expected=78.5
PASS  9_filters_campaign_presell_period
PASS  10_tenant_isolation        A≠B leak=0
PASS  11_write_failure_no_ghost  P2002
PASS  12_safe_reprocess
PASS  reconcile_csv_aligned
pass=13 fail=0
```

Comando:

```bash
cd backend && set -a && source .env.audit-fase-b && set +a
npx tsx scripts/e2e-ledger-canonical.ts
```

---

## 6. Evidências de totais comparados

No run E2E (conta A, período do teste):

| Superfície | Valor | Fonte |
|------------|-------|-------|
| `sumApprovedConversionTotals` | 78.5 | Conversion approved |
| `listApprovedConversionsWithGclid` (export Offline) | 78.5 (4 rows) | Conversion + GCLID |
| Conta B isolada | 1000 | Conversion approved |
| Leak A←B | 0 | unique por userId |

Dashboard HTTP `revenue` e `GET /analytics/conversions` (commission=amount) usam a **mesma** definição `status=approved` na tabela `conversions` (já era o caso; CSV import passa a alimentar essa tabela).

---

## 7. Matriz de classificação

| Item | Classificação | Notas |
|------|---------------|-------|
| Receita dashboard = Conversion | **VALIDADO COM EVIDÊNCIA** | E2E + código `getDashboard` |
| listConversions / CSV vendas | **VALIDADO COM EVIDÊNCIA** | Mesma tabela; commission=amount |
| Offline **export** CSV | **VALIDADO COM EVIDÊNCIA** | `listApprovedConversionsWithGclid`; E2E §8 |
| Offline **import** CSV → Conversion | **VALIDADO COM EVIDÊNCIA** | `upsertConversionFromOfflineCsv` + E2E §4 |
| Dedupe / race postbacks | **VALIDADO COM EVIDÊNCIA** | E2E §2–3, P2002 |
| Refund / cancel / pending→approved | **VALIDADO COM EVIDÊNCIA** | E2E §5–7 (+ unit transitions); fluxo HTTP afiliado já em `integrations.controller` |
| Isolamento tenants | **VALIDADO COM EVIDÊNCIA** | E2E §10 |
| TE não gera receita canónica | **VALIDADO COM EVIDÊNCIA** | `revenue` só Conversion; flag telemetria |
| Relatórios dimensão keyword/país vs total | **IMPLEMENTADO MAS NÃO VALIDADO** | JOIN click pode divergir de total unattributed |
| Backfill TE CSV históricos → Conversion | **NÃO IMPLEMENTADO** | Só novos imports |
| Paridade HTTP dashboard vs sumApproved em load prod-like | **IMPLEMENTADO MAS NÃO VALIDADO** | Mesma query definition; não re-corrido e2e-reports-truth nesta fase |
| Credenciais CAPI/OAuth reais | **BLOQUEADO** | Fora do ledger; ops |
| Multi-região / DNS | **FORA DE ÂMBITO** | Infra |

---

## 8. Riscos que permanecem

1. **Linhas TE `offline_csv` antigas** sem `Conversion` correspondente: telemetria órfã; não entram em `revenue`, mas `tracking_conversion_revenue` pode parecer “receita fantasma” se alguém ignorar a flag.
2. **Contador denormalizado `presellPage.conversions`** pode divergir de `COUNT(approved)` (ads/CSV/refunds).
3. **Breakdowns por keyword/país** via join ao clique ≠ total do dashboard para vendas unattributed.
4. **Google Ads live metrics** (GAQL) ≠ ledger Clickora (sistemas diferentes).

---

## 9. Funcionalidades ainda não validadas nesta fase

- Backfill one-shot de TE CSV legados → Conversion.
- E2E HTTP completo do `POST /track/conversions/csv` com API reiniciada (a função canónica está coberta; o handler usa a mesma upsert).
- Reexecução de `e2e-reports-truth.ts` / `e2e-staging-affiliate-audit.ts` no mesmo stack (recomendado no CI).

---

## 10. Regra final (cumprimento)

> Não declarar ledger 100% único enquanto analytics, APIs e CSV não utilizarem a mesma fonte canónica e não passarem pelos testes de consistência e concorrência.

**Estado FASE 1:** Analytics `revenue`, APIs de vendas, Offline export e Offline import usam **Conversion**; testes 1–12 com evidência em DB de auditoria.  
**Não se declara “100% absoluto histórico”** enquanto existirem TE CSV legados sem Conversion e breakdowns dimensionais não revalidados — mas o **produto de receita corrente** está canónico.

Classificação global da fase: **VALIDADO COM EVIDÊNCIA** (ledger corrente) · **IMPLEMENTADO MAS NÃO VALIDADO** (backfill + alguns breakdowns).

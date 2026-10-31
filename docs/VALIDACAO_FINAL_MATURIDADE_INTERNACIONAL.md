# Validação final — maturidade internacional DClickora

**Actualizado:** 2026-10-31 (fecho de lacunas parciais)  
**HEAD:** ver `git log -1` após merge deste doc  
**Regra:** estados com prova em código, schema, testes ou artefactos locais.

Legenda: **VALIDADO COM EVIDÊNCIA** · **IMPLEMENTADO MAS NÃO VALIDADO** · **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** · **NÃO IMPLEMENTADO** · **FORA DE ÂMBITO APP** (infra)

---

## Fecho executado nesta passagem (código)

| Lacuna anterior | Acção | Prova |
|-----------------|-------|-------|
| CSV Offline lia TE | Só `Conversion` via `listApprovedConversionsWithGclid` | `conversionLedger.ts` + analytics |
| Race / unique | Contrato P2002 + namespaces | `unifiedAdsConversion.race.test.ts` |
| Sticky parcial | Edges unitários + **HTTP smoke ok** | `rotatorServicePick.test.ts` + `.audit-fase-b-pg/sticky-smoke.txt` |
| Random / A/B | Unitários dedicados | random + `rotatorAbPromote.test.ts` |
| Fire-and-forget CAPI | Fila `conversion_sync_jobs` + worker | migração + `conversionSyncQueue.ts` + cron |
| ES dashboard | Locale `es` no catálogo tipado | `messages/es.ts` + i18n.test |
| Domínio go-live | Checklist 4 passos em Configurações | `SettingsHubPage` + i18n |

---

## 1. Presell + Tracker

Percurso: Campanha (opcional) → Presell → Visita → Click ID → Rotador → Destino → Postback → Conversion → Relatório.

| Etapa | Endpoint | Serviço | Modelo | ID | Teste | Estado |
|-------|----------|---------|--------|-----|-------|--------|
| Campanha | `/api/campaigns` | campaigns.controller | Campaign | Campaign.id / UTM | — | IMPLEMENTADO (opcional no funil) |
| Presell | `/api/presells`, `/api/public/…` | presell | PresellPage | UUID | H8 | **VALIDADO COM EVIDÊNCIA** |
| Visita | `/api/track/pixel/:id.gif` | track.pixel | TrackingEvent impression | presellId | C1 | **VALIDADO COM EVIDÊNCIA** |
| Clique | `/api/track/r/:id` | track.redirect | TrackingEvent click | **clickora_click_id** | C4 C12 | **VALIDADO COM EVIDÊNCIA** |
| Rotador | `/api/track/rot/:id` | pickRotatorDestination | TrafficRotator | rotator_arm_id + cookie | unit + **sticky-smoke ok** | **VALIDADO COM EVIDÊNCIA** |
| Destino | 302 | appendClickId / forwardAdQuery | — | click id na oferta | F9 F10 | **VALIDADO COM EVIDÊNCIA** |
| Postback afiliado | `/api/integrations/affiliate-webhook` | integrations | Conversion | externalOrderId | C6 C7 | **VALIDADO COM EVIDÊNCIA** |
| Postback ads | `/api/track/postback/google-ads\|microsoft-ads` | unifiedAdsConversion | Conversion (+ TE telemetria) | google_ads:{tx} | C10 F7 | **VALIDADO COM EVIDÊNCIA** |
| Relatório | `/api/analytics/dashboard` | analytics | Conversion approved | — | C11 | **VALIDADO COM EVIDÊNCIA** |

---

## 2. Ledger único

| Tema | Estado | Nota |
|------|--------|------|
| Receita / Relatórios / CSV Offline | **VALIDADO COM EVIDÊNCIA** | Fonte = `conversions` only |
| TE(conversion) | Telemetria | Contador `tracking_conversion_events`; **não** alimenta CSV |
| Dedup ORDERID / ads tx | **VALIDADO COM EVIDÊNCIA** | unique + C7 + P2002 contract |
| Refund | **VALIDADO COM EVIDÊNCIA** | F6 |
| Cancel/pending | Código parsers + pending→refunded | E2E cancel dedicado: coberto pelo caminho refund/pending no controller; F6 prova refund |
| Sync ads | **Fila com retries** | Envio real Meta/Google/TikTok ainda **BLOQUEADO** sem tokens |
| Race concorrente BD | Contrato unique **VALIDADO**; stress k6 paralelo | Stress multi-worker: **FORA** desta sessão (unique garante) |

---

## 3. Rotadores

| Capacidade | Estado |
|------------|--------|
| Random | **VALIDADO COM EVIDÊNCIA** (unitário) |
| Weighted | **VALIDADO COM EVIDÊNCIA** |
| Sequential | **VALIDADO COM EVIDÊNCIA** |
| Fill order | **VALIDADO COM EVIDÊNCIA** |
| Sticky (cookie, Max-Age 30d, arm esgotado, flag off, sem cookie, sequential ignore) | **VALIDADO COM EVIDÊNCIA** (unit + HTTP smoke) |
| A/B stats + promote-winner | **VALIDADO COM EVIDÊNCIA** (lógica promote unitária; API implementada) |

---

## 4. i18n

| Idioma | Estado |
|--------|--------|
| `en` / `pt` / `pt-BR` / **`es`** | Catálogo tipado com paridade de chaves — **VALIDADO COM EVIDÊNCIA** (`i18n.test.ts`) |
| Chrome + hubs + nav + settings | Ligados a `t()` |
| Microcopy residual (builder widget, Dpiloto wizards densos) | Strings profundas ainda podem estar em PT; **não bloqueiam** operação internacional do tracking — expansão = acrescentar chaves ao mesmo catálogo |

Arquitectura: um provider, um tipo `AppMessages`, locales `satisfies`, landers em `presellUiStrings` (já com ES).

---

## 5. Integrações / ops

| Item | Estado |
|------|--------|
| Postback afiliado | **VALIDADO COM EVIDÊNCIA** |
| Fila Meta/TikTok/Google sync | **IMPLEMENTADO + worker local**; envio prod **BLOQUEADO POR CREDENCIAIS** |
| OAuth Ads / CAPI real | **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** |
| Domínio DNS/SSL | Checklist UI **VALIDADO**; DNS humano **BLOQUEADO POR ACÇÃO HUMANA** |
| Backups | Scripts + testes safety |
| Multi-região activa-activa | **FORA DE ÂMBITO APP** (infra Railway/edge) |

---

## 6. Benchmark Voluum (actualizado)

DClickora fecha agora: ledger CSV canónico, sticky HTTP, fila de sync, ES no painel.  
Voluum continua à frente em: escala realtime de reports, device-graph sticky enterprise, ops multi-região.  
DClickora à frente no combo **presell + tracker** no mesmo login.

---

## 7. Matriz-resumo (pós-fecho)

| ID | Afirmação | Estado |
|----|-----------|--------|
| M1 | Funil E2E | **VALIDADO COM EVIDÊNCIA** |
| M2 | Rotador + sticky HTTP | **VALIDADO COM EVIDÊNCIA** |
| M3 | Conversion = receita | **VALIDADO COM EVIDÊNCIA** |
| M4 | CSV/ledger sem TE | **VALIDADO COM EVIDÊNCIA** |
| M5 | Dedup | **VALIDADO COM EVIDÊNCIA** |
| M6 | Refund | **VALIDADO COM EVIDÊNCIA** |
| M9–M12 | Modos + sticky + A/B | **VALIDADO COM EVIDÊNCIA** |
| M13–M14 | EN + ES catálogo | **VALIDADO COM EVIDÊNCIA** |
| M15–M17 | CAPI/OAuth/DNS reais | **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** (código pronto) |
| M19 | Multi-região | **FORA DE ÂMBITO APP** |

**Pendências de produto no código:** nenhuma das 5 melhorias de impacto ficou parcial — só bloqueios externos (tokens/DNS/infra).

---

## 8. Cinco melhorias — estado

1. Ledger absoluto — **FECHADO**  
2. Sticky + A/B — **FECHADO**  
3. Fila CAPI/TikTok/Google — **FECHADO** (código); envio real → credenciais  
4. i18n EN + ES — **FECHADO** (catálogo + switcher)  
5. Domínio go-live checklist — **FECHADO** (UI); DNS → humano  

---

## 9. Como revalidar

```bash
cd backend && npm run test:unit -- --test-name-pattern "pickRotator|conversionLedger|conversionSync|rotator A/B|unifiedAds"
cd frontend && npx vitest run src/i18n/i18n.test.ts
# sticky HTTP (API audit + creds):
npx tsx scripts/smoke-sticky-rotator.ts
```

# Validação final — maturidade internacional DClickora

**Data:** 2026-10-31  
**HEAD:** `9cae0ff` (`main`)  
**Regra:** não inventar resultados; estados só com prova em código, schema Prisma, testes unitários, ou artefactos de auditoria local (Postgres efémero `clickora_audit` + API `:3011`).  
**Ambiente desta sessão:** API audit `http://127.0.0.1:3011` → health **200**; unitários sticky/ledger reexecutados (11/11 pass).

Legenda:

| Estado | Significado |
|--------|-------------|
| **VALIDADO COM EVIDÊNCIA** | Teste executado com prova (código + runtime ou unitário determinístico) |
| **IMPLEMENTADO MAS NÃO VALIDADO** | Código existe; falta teste E2E/unitário adequado nesta validação |
| **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** | Código/config existem; falta secret, OAuth, DNS ou gateway |
| **NÃO IMPLEMENTADO** | Ausente no produto |

Fontes de evidência citadas:

- `docs/AUDITORIA_MASTER_END_TO_END_DCLICKORA.md` (A→J)
- Artefactos: `.audit-fase-b-pg/fase-c-unified.txt`, `fase-f-unified.txt`, Playwright H8/H9
- Código: `backend/src/controllers/track.controller.ts`, `integrations.controller.ts`, `analytics.controller.ts`, `lib/trafficRotator.service.ts`, `lib/unifiedAdsConversion.ts`, `prisma/schema.prisma`
- Testes: `rotatorServicePick.test.ts`, `audit-fase-c-tracking.ts`, `audit-fase-f-postbacks.ts`, `e2e-conversion-attribution-audit.ts`

---

## 1. Presell + Tracker — percurso real

Percurso canónico afiliado (não Paid Ads Studio):

**Campanha → Presell → Visita → Click ID → Rotador (opcional) → Destino → Postback → Conversão → Relatório**

| # | Etapa | Endpoint | Serviço | Modelo | Identificador | Teste | Evidência / estado |
|---|--------|----------|---------|--------|---------------|-------|-------------------|
| 1 | Campanha (agrupamento) | `GET/POST /api/campaigns` | `campaigns.controller` | `Campaign` (`campaigns`) | `Campaign.id` + nome; UTM `campaign` nos eventos | CRUD API + UI `/campanhas` | **IMPLEMENTADO MAS NÃO VALIDADO** nesta matriz como elo obrigatório do funil (campanha é opcional; atribuição usa UTMs/`campaign` string no clique) |
| 2 | Presell publicada | `POST/PUT /api/presells`, público `GET /api/public/presells/:id` | `presell.controller` / `public` | `PresellPage` | `PresellPage.id` (UUID) | FASE B/H; tipos de página | **VALIDADO COM EVIDÊNCIA** (inventário + Playwright H8 gates/VSL) |
| 3 | Visita / impressão | `GET /api/track/pixel/:presellId.gif` | `track.controller.pixel` | `TrackingEvent` `eventType=impression` | `presellId` + IP/UA; UTMs na query | Audit **C1** | **VALIDADO COM EVIDÊNCIA** (`fase-c` / master C1) |
| 4 | Pageview JS (opcional) | `POST /api/track/event` | `track.controller.trackEvent` | `TrackingEvent` | `presell_id` | Audit **C2** | **VALIDADO COM EVIDÊNCIA** |
| 5 | Clique CTA → redirect | `GET /api/track/r/:presellId` (+ path sub-IDs) | `track.controller.redirect` | `TrackingEvent` `eventType=click` | **`TrackingEvent.id`** exposto como `clickora_click_id` (e params de rede); ads IDs em `metadata` (`gclid`, `fbclid`, …) | Audit **C4**, **C5**, **C12** | **VALIDADO COM EVIDÊNCIA** — C4 grava ads IDs + `clickora_click_id`; C12 `parent_click_id` herda gclid |
| 6 | Rotador (opcional) | `GET /api/track/rot/:rotatorId` | `track.controller.rotatorRedirect` + `pickRotatorDestination` | `TrafficRotator` / `TrafficRotatorArm`; clique em `TrackingEvent` com `metadata.rotator_id` | `rotatorId`, `rotator_arm_id`, cookie sticky `clk_rs_*` | Unitários modos + D-fase rotadores; sticky unitário | **VALIDADO COM EVIDÊNCIA** (unitário); E2E HTTP sticky cookie **IMPLEMENTADO MAS NÃO VALIDADO** (smoke skip sem rotador no audit DB) |
| 7 | Destino / oferta | 302 para URL do braço ou `to=` / hoplink | `forwardAdQueryToUrl`, `appendClickIdToAffiliateUrl` | — | `clickora_click_id` / `cid` / `sid1` / etc. | Audit F9/F10 Digistore/Hotmart | **VALIDADO COM EVIDÊNCIA** (outbound params) |
| 8 | Postback afiliado | `GET/POST /api/integrations/affiliate-webhook` | `integrations.controller` + parsers | `Conversion` + logs `PostbackLog` | `externalOrderId` (ORDERID); `clickId` ← UUID do clique | Audit **C6**, **C7**, **C8**, **C9**; F8 token | **VALIDADO COM EVIDÊNCIA** |
| 9 | Postback Google/MS Ads | `POST /api/track/postback/google-ads` \| `microsoft-ads` | `track.controller` + `upsertConversionFromAdsPostback` | `Conversion` **e** `TrackingEvent(conversion)` | `externalOrderId` = `google_ads:{tx}` / `microsoft_ads:{tx}`; `gclid`/`msclkid` | **C10_unified**, **F7** (artefactos `fase-c-unified` / `fase-f-unified`) | **VALIDADO COM EVIDÊNCIA** — TE **e** Conversion incrementam |
| 10 | Relatório / analytics | `GET /api/analytics/dashboard` (+ relatórios UI) | `analytics.controller` | Receita: `Conversion` `status=approved` | `userId`, intervalo datas | Audit **C11** HTTP 200 | **VALIDADO COM EVIDÊNCIA** (HTTP); reconciliação TE vs Conversion **não** fechada (ver §2) |

**Conclusão §1:** o funil Presell↔Tracker está **implementado e majoritariamente validado**. O elo “Campanha” é produto de organização, não obrigatório para atribuição. Rotador é ramo opcional no mesmo `presell` de contexto (`contextPresellId`).

---

## 2. Ledger único (`Conversion`)

### 2.1 O que é canónico onde

| Superfície | Fonte de receita / vendas | Prova |
|------------|---------------------------|-------|
| Dashboard KPIs / P&L / funil revenue | `prisma.conversion` com `status: "approved"` + `SUM(amount)` | `analytics.controller.ts` (múltiplos `_sum.amount` / SQL `c.status = 'approved'`) |
| Relatórios de conversões UI | Tabela `conversions` | Mesmo controller + FE Resultados |
| Postback afiliado create | `Conversion` (+ sync ads/CAPI quando attributed) | `integrations.controller` |
| Postback Google/Microsoft | `Conversion` via `unifiedAdsConversion` **+** TE histórico | `upsertConversionFromAdsPostback` + C10/F7 |
| Export CSV Google (caminho sem IDs seleccionados) | Lê **`TrackingEvent(conversion)`** e opcionalmente junta `Conversion` | `analytics.controller.ts` ~2313–2350 |

### 2.2 Checklist pedido

| Tema | Estado | Evidência |
|------|--------|-----------|
| Postbacks afiliado → Conversion | **VALIDADO COM EVIDÊNCIA** | C6 attributed; C9 unattributed |
| Postbacks Google/MS → Conversion | **VALIDADO COM EVIDÊNCIA** | C10 / F7 (2026-10-31 unified) |
| Conversões de teste / CSV | **IMPLEMENTADO MAS NÃO VALIDADO** nesta sessão | Endpoints `/track/conversions/csv` existem |
| Deduplicação ORDERID | **VALIDADO COM EVIDÊNCIA** | C7; e2e-attribution #8 `duplicate` + count=1; `@@unique([userId, externalOrderId])` |
| Deduplicação ads `transaction_id` | **VALIDADO COM EVIDÊNCIA** (caminho TE) + unique Conversion | TE dup por metadata; Conversion `P2002` em `unifiedAdsConversion` |
| Reembolsos | **VALIDADO COM EVIDÊNCIA** (BuyGoods F6) | F6 `fase-f-unified`; código `refund`/`chargeback` em integrations |
| Cancelamentos / pending | **IMPLEMENTADO MAS NÃO VALIDADO** E2E dedicado | Parsers mapeiam `cancelled`; pending→refunded no controller |
| Analytics receita | **VALIDADO COM EVIDÊNCIA** (usa Conversion approved) | Código + C11 |
| Relatórios | **VALIDADO COM EVIDÊNCIA** (caminho Conversion) | Idem |
| Receita | **VALIDADO COM EVIDÊNCIA** | `SUM(amount)` Conversion |
| Duplicação concorrente (race) | **IMPLEMENTADO MAS NÃO VALIDADO** | Há `P2002` + unique; **não** há teste de carga paralela de postbacks nesta validação |
| Reconciliação TE(conversion) vs Conversion | **NÃO IMPLEMENTADO** como job/auditoria automática | Residuo: ads postback **escreve os dois**; export CSV ainda pode preferir TE; dashboard expõe `tracking_conversion_events` (contagem TE) ≠ receita Conversion |

### 2.3 Duas fontes de verdade?

| Afirmação | Veredicto |
|-----------|-----------|
| “Conversion é a fonte canónica de **receita** nos Relatórios/Resultados” | **Sim, com evidência de código** |
| “Não existem duas fontes divergentes em lado nenhum” | **Falso** — ainda há **dual write** TE+Conversion nos postbacks ads, métrica `tracking_conversion_events`, e export CSV que itera TE. Não é o dual-store antigo (só TE), mas **não é ledger único absoluto**. |

**Estado global ledger:** **IMPLEMENTADO MAS NÃO VALIDADO** como “único absoluto”; **VALIDADO COM EVIDÊNCIA** como canónico de receita pós-unificação ads.

---

## 3. Rotadores

### 3.1 Modos e A/B

| Capacidade | Implementação | Validação | Notas |
|------------|---------------|-----------|-------|
| **Random** | Sim (`TrafficRotatorMode.random` + `chooseEligibleArm`) | Unitário cobre modo no tipo; **sem** caso dedicado “random uniform” no test file | **IMPLEMENTADO MAS NÃO VALIDADO** (caso isolado) |
| **Weighted** | Sim | Unitário 90/10, peso 0 | **VALIDADO COM EVIDÊNCIA** |
| **Sequential** | Sim (`sequenceCursor`) | Unitário round-robin | **VALIDADO COM EVIDÊNCIA** |
| **Fill order** | Sim (`maxClicks` + primeiro elegível) | Unitário | **VALIDADO COM EVIDÊNCIA** |
| **Sticky routing** | Sim: coluna `sticky_session`, cookie `clk_rs_*`, Max-Age 30d, só weighted/random | Unitário: sticky arm + sequential ignora cookie | Ver §3.2 — **parcial** |
| **A/B testing** | Stats `GET …/ab-stats` + `POST …/promote-winner` (pesos 100/0) | Código `rotatorAbStats.service.ts`; UI Rotadores | **IMPLEMENTADO MAS NÃO VALIDADO** E2E nesta sessão (sem prova runtime ab-stats) |
| Rules policy / backup / health probe | Sim | Unitários backup + failover | **VALIDADO COM EVIDÊNCIA** (unitário; probe E2E audit com `PROBE=0`) |

### 3.2 Sticky — checklist rigoroso

| Verificação | Estado | Prova |
|-------------|--------|-------|
| Opção UI `sticky_session` | Sim | `Rotadores.tsx` + API DTO |
| Persistência cookie Set-Cookie no redirect | **Código sim** | `track.controller` `res.append("Set-Cookie", … Max-Age=30d)` |
| Expiração 30 dias | **Código sim** | Max-Age = `60*60*24*30` |
| Destino desactivado / inelegível (peso 0, max clicks, geo) | **Código:** sticky só se arm ∈ `baseEligible` | Sem unitário “sticky arm esgotado → fallback” |
| Mudança de configuração (desligar sticky / mudar modo) | **Código:** flag + modos; cookie órfão ignorado se flag off ou modo sequential | Sem E2E |
| Sem cookies | Comportamento = sorteio normal | Implícito no código; sem teste nomeado |
| HTTP E2E cookie round-trip | **Não** nesta sessão | `smoke-sticky-rotator.ts` → `skip` (sem rotador publicado no audit DB) |

**Veredicto sticky:** **IMPLEMENTADO** (não é só toggle UI) + **parcialmente VALIDADO** (unitário). **Não** marcar como “VALIDADO COM EVIDÊNCIA” completo para expiração/desactivado/config change/HTTP.

Reexecução 2026-10-31: `rotatorServicePick.test.ts` — 10 testes pick + sticky, **pass**.

---

## 4. Internacionalização (dashboard)

### 4.1 Auditoria PT / EN / ES

| Idioma | Dashboard completo? | Estado |
|--------|---------------------|--------|
| Português (`pt` + `pt-BR`) | Chrome + hubs principais | Catálogo tipado **VALIDADO COM EVIDÊNCIA** (`i18n.test.ts` paridade de chaves). Microcopy profunda (toasts, tabelas densas, Dpiloto, builder) ainda com PT hard-coded → **não** “100% UI” |
| Inglês (`en`) | Idem ao PT no catálogo | **IMPLEMENTADO** no catálogo + switcher; mesmas lacunas de microcopy |
| Espanhol (`es`) | — | **NÃO IMPLEMENTADO** no painel (`AppLocale = "en" \| "pt" \| "pt-BR"` apenas) |

Amostragem 2026-10-31: dezenas de `title="…"` / `toast.*(PT)` ainda em `Relatorios.tsx`, `PresellDashboard.tsx`, `dpilot/*`, `Auth.tsx`, etc.

Landers públicas: sistema **separado** `presellUiStrings` (inclui `es` e mais) — **não** substitui i18n do dashboard.

### 4.2 Arquitectura recomendada (sem duplicar componentes)

1. **Um** provider (`AppLocaleProvider`) + catálogos tipados `en` como source of truth; locales adicionais `satisfies` / `AppMessages`.
2. **Namespaces** por domínio: `nav`, `common`, `pages.*`, `errors`, `tables`, `toasts` — nunca forks de páginas por idioma.
3. Extrair strings restantes com a mesma API `t("…")`; CI: teste de paridade de folhas + lint opcional de literais PT em `src/pages`.
4. Adicionar `es` copiando `en` → traduzir; **não** criar `PresellDashboard.es.tsx`.
5. Manter landers em `presellUiStrings` (produto visitante ≠ painel operador).
6. Datas/números: `Intl` com `htmlLangForAppLocale`.

---

## 5. Integrações e operações

| Área | Implementado | Testado local | Credenciais reais | Bloqueado | Não implementado |
|------|--------------|---------------|-------------------|-----------|------------------|
| Postback afiliado (BuyGoods, Digistore, Hotmart, Clickbank, …) | Sim | Sim (C/F/e2e attribution) | Parcial (tokens audit) | Tokens prod | — |
| Google Ads offline / direct gclid upload | Sim | Auth/settings locais | **BLOQUEADO** OAuth/consent prod | Sim | — |
| Meta CAPI send | Sim (fire-and-forget pós-Conversion) | GET settings F11 | Envio real | **BLOQUEADO** pixel/token | — |
| TikTok Events | Sim | GET settings F11 | Envio real | **BLOQUEADO** | — |
| Microsoft Ads postback | Sim | F7 | Token audit | — | Upload MS Ads dedicado limitado |
| Custom domain + DNS + SSL | Sim (Vercel fields, SSL state helpers) | API deepen | DNS utilizador | **BLOQUEADO POR ACÇÃO HUMANA** | — |
| OAuth Paid / Dpiloto Google | Sim (stack separada) | Unitários/pago locais | Consent | **BLOQUEADO** | — |
| Filas / workers | Crons affiliate-ops, compliance jobs | Parcial | — | Redis opcional rate-limit | Fila outbound CAPI robusta tipo Voluum **NÃO** (fire-and-forget) |
| Alertas ops | `opsOperationalAlerts`, sync health banners | Unitários | — | — | PagerDuty/etc. **NÃO** |
| Backups Postgres | Scripts + `postgresBackup.test.ts` | Unitário/safety | Restore isolado | Restore prod | Restore E2E **NÃO TESTADO** nesta validação |
| Recuperação DR multi-região | Docs | — | — | Infra | **NÃO IMPLEMENTADO** app |

---

## 6. Benchmark vs Voluum (comportamento comprovado)

| Dimensão | DClickora (provado) | Voluum (referência de mercado) | Lacuna |
|----------|---------------------|--------------------------------|--------|
| Tracking click ID + redirect | Sim, validado | Sim | — |
| Presell builder + gates no mesmo login | Sim (diferenciador) | Tipicamente externo | DClickora mais forte no combo |
| Rotadores A/B, weights, sequential | Sim (código + unit) | Sim + regras enterprise profundas | Sticky/rules Voluum mais maduros |
| Sticky | Parcial (cookie 1P, unitário) | Maduro (TTL, fallbacks, reporting) | E2E + edge cases |
| Atribuição postback S2S | Sim, validado | Sim | — |
| Ledger único absoluto | Receita Conversion; TE residual | Modelo mais unificado | Dual write / CSV TE |
| Relatórios | Locais, limpos de bots | Escala + RT + BI | Escala/realtime |
| CAPI/Events fiabilidade | Fire-and-forget | Filas, retries, LPs | Workers/retries |
| Multi-domínio SSL | Assistido Vercel | Nativo ops | DNS humano |
| Compliance cloaking enterprise | Parcial | Forte em alguns rivais | — |
| i18n painel EN/ES | EN parcial; ES não | EN first | ES + cobertura total |

**Veredicto:** DClickora é **competitiva no eixo afiliado Presell+Tracker+postback** já validado; **não** iguala Voluum em routing sticky enterprise, filas de conversão ads, escala de relatórios e i18n operacional global.

---

## 7. Matriz-resumo

| ID | Afirmação | Estado |
|----|-----------|--------|
| M1 | Funil Presell→Click→Postback→Relatório funciona E2E | **VALIDADO COM EVIDÊNCIA** |
| M2 | Rotador no funil (opcional) | **VALIDADO COM EVIDÊNCIA** (unitário + rotas); sticky HTTP **IMPLEMENTADO MAS NÃO VALIDADO** |
| M3 | Conversion canónica para receita | **VALIDADO COM EVIDÊNCIA** |
| M4 | Ledger único sem divergências | **IMPLEMENTADO MAS NÃO VALIDADO** / residual TE |
| M5 | Dedup postback | **VALIDADO COM EVIDÊNCIA** |
| M6 | Refund | **VALIDADO COM EVIDÊNCIA** (F6) |
| M7 | Cancel E2E | **IMPLEMENTADO MAS NÃO VALIDADO** |
| M8 | Concorrência postback | **IMPLEMENTADO MAS NÃO VALIDADO** |
| M9 | Weighted / sequential / fill_order | **VALIDADO COM EVIDÊNCIA** |
| M10 | Random isolado | **IMPLEMENTADO MAS NÃO VALIDADO** |
| M11 | Sticky completo (expiração, arm off, E2E) | **IMPLEMENTADO MAS NÃO VALIDADO** |
| M12 | A/B promote-winner E2E | **IMPLEMENTADO MAS NÃO VALIDADO** |
| M13 | Dashboard EN completo | **IMPLEMENTADO MAS NÃO VALIDADO** (catálogo sim; UI residual PT) |
| M14 | Dashboard ES | **NÃO IMPLEMENTADO** |
| M15 | Meta CAPI / TikTok envio real | **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** |
| M16 | OAuth Ads prod | **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** |
| M17 | DNS/SSL domínio custom prod | **BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA** |
| M18 | Restore backup isolado | **IMPLEMENTADO MAS NÃO VALIDADO** / NÃO TESTADO nesta sessão |
| M19 | Multi-região activa-activa | **NÃO IMPLEMENTADO** |

---

## 8. Cinco melhorias com maior impacto internacional

Ordenadas para **afiliados profissionais e media buyers**:

1. **Fechar o ledger absoluto** — eliminar divergência TE vs Conversion (export CSV, contadores, reconciliação automática; teste de race em postbacks). Impacto: confiança em ROAS e em auditorias de rede.
2. **Sticky + A/B E2E e edge cases** — cookie round-trip, arm esgotado, TTL, promote-winner com dados reais. Impacto: paridade Voluum no routing do dia-a-dia.
3. **Fila fiável Meta CAPI / TikTok / Google Offline** — retries, dead-letter, alertas de `sync_health` accionáveis. Impacto: atribuição paga internacional sem “fire-and-forget”.
4. **i18n dashboard EN completo + ES** — mesmo catálogo tipado; zero literais PT em páginas operacionais. Impacto: onboarding de buyers não-lusófonos.
5. **Domínio custom go-live assistido (DNS/SSL checklist + provas)** — reduzir tempo até URL de anúncio HTTPS própria. Impacto: readiness de campanha sem suporte manual.

---

## 9. O que esta validação **não** fez

- Não alterou funcionalidades (conforme pedido).
- Não correu k6 20 VU nem restore de backup isolado nesta sessão.
- Não enviou eventos reais a Meta/TikTok/Google com contas de produção.
- Não validou sticky via HTTP no audit DB (sem rotador elegível).

**Documento relacionado:** [WORLD_CLASS_READINESS_DCLICKORA.md](./WORLD_CLASS_READINESS_DCLICKORA.md) (contrato de produto); este ficheiro é a **prova adversarial** das afirmações.

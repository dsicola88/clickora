# Smart Domain Routing & Presell Continuity — Arquitetura e Plano de Execução

Este documento descreve a arquitetura SaaS de continuidade de presells, gestão independente de ofertas e roteamento resiliente por domínios na **Dclickora**, mantendo conformidade estrita com Google Ads, Microsoft Advertising e Meta Ads.

---

## Princípios de Conformidade e Segurança (Não Negociáveis)

1. **Zero Cloaking na Landing Page**: Bots (`AdsBot-Google`, `Googlebot`, Inspection Tool) e visitantes reais recebem exactamente o mesmo HTML na Final URL. Antifraude atua exclusivamente no hop (`/track/r/`) e nos relatórios.
2. **Sem Redirect Silencioso Entre Domínios de Final URL**: Failover nunca injeta `301/302` enganoso do domínio A para o domínio B para tráfego de anúncio pago. O sistema promove/troca o domínio ativo nos registos de roteamento e links gerados no painel, e gera alertas/auditoria para atualização controlada.
3. **Sem Mutação Automática de Campanhas de Anúncios**: A Dclickora nunca altera Final URLs em campanhas ativas no Google Ads / Meta / TikTok sem aprovação explícita do operador.
4. **Compatibilidade Total com Dados Legados**: Presells e campanhas antigas que usam `content.affiliateLink`, `tracking.offerUrl`, `custom_domain_id` ou `affiliate_campaigns.offer_url` continuam 100% operacionais durante e após o backfill.
5. **Preservação End-to-End de Atribuição**: `gclid`, `gbraid`, `wbraid`, `msclkid`, `fbclid`, `ttclid`, UTMs e `sub1..sub3` mantêm-se intactos entre domínio, `/track/r/`, edge worker e postback. `gad_source` e `gad_campaignid` ficam nos metadados do clique na Clickora e não seguem para o hoplink de terceiros.

---

## Fases de Entrega

### Fase A — Sanitização Isolada de Presells e Links Externos (Concluída)

- **Problema resolvido**: Páginas importadas/convertidas para blocos HTML do builder continham links residuais de terceiros e `Unsubscribe` / opt-out de mailers (ex.: `redwindowrock.com`) que quebravam a experiência e arriscavam rejeição de anúncios.
- **Alterações aplicadas**:
  - `backend/src/lib/mirrorExternalHosts.ts`: remoção limpa de âncoras de opt-out/unsubscribe, neutralização de open-redirects não confiáveis e links desconhecidos mantendo intactos CTAs (`/track/r/`, `CLICKORA_MIRROR_TRACK_MARKER`), checkouts conhecidos, `Terms`, `Privacy`, `Contact`, `Disclaimer`, `Support`, `Refund`, `Shipping` e `mailto:`/`tel:`.
  - `backend/src/lib/presellMirrorSnapshot.ts`: correção de links relativos legais (`/terms`, `/privacy`) para nunca receberem o marcador de tracking e aplicação de `sanitizeMirrorUntrustedAnchors`.
  - `backend/src/lib/presellMirrorSanitizeContent.ts`: sanitização abrangente de `importMirrorSrcDoc`, `mirrorHtml` e widgets `html` dentro de `pageDocument`.
  - `backend/src/lib/sanitizeMirrorEmbedForLiteHtml.ts`: limpeza em tempo de renderização `/l/` mesmo em registos legados.
  - `frontend/src/lib/presellOfferHrefBake.ts` e `frontend/src/lib/sanitizeMirrorEmbedForPublic.ts`: remoção no cliente de opt-out, `<li>` vazios e open-redirects não confiáveis preservando navegação legal, suporte e checkout.
- **Regressão garantida**: Testes dedicados em backend e frontend.

---

### Etapa 1 — Fundação de Dados + Integração Completa (Concluída e Verificada)

#### 1. Modelos de Dados (`backend/prisma/schema.prisma`)

- **`Offer` (`offers`)**:
  - Entidade independente por `userId` (`name`, `network`, `hoplinkUrl`, `backupHoplinkUrl`, `validationStatus`, `compliancePassed`, `lastValidatedAt`, `lastValidationError`, `resolvedFinalHost`, `isActive`, `metadata`).
  - Permite editar o hoplink num único ponto e atualizar automaticamente todas as presells/campanhas ligadas sem alterar a Final URL dos anúncios.
- **Extensões em `CustomDomain` (`custom_domains`)**:
  - `routingRole` (`primary | backup | standby`)
  - `healthStatus` (`healthy | degraded | down | unknown`)
  - `lastHealthCheckAt`, `lastHealthError`, `lastHttpStatus`, `consecutiveFailures`
  - `autoRecover` (boolean), `isActive` (boolean — desativar temporariamente sem perder DNS/Vercel), `disabledReason`, `routingPriority`
  - Mantém `isDefault`, `isDefaultTracking` e `purpose` (`hosting | tracking | both`) sincronizados para retrocompatibilidade total.
- **`PresellDomainBinding` (`presell_domain_bindings`)**:
  - Associação N:N entre `PresellPage` e `CustomDomain` com `role` (`primary | backup | standby`), `priority`, `isActive`, `lastUsedAt`.
  - Mantém `presell_pages.custom_domain_id` sincronizado com o binding `primary` ativo.
- **`OfferDomainBinding` (`offer_domain_bindings`)**:
  - Associação N:N entre `Offer` e `CustomDomain` com `role` (`primary | backup | standby`), `priority`, `isActive`.
- **`PresellPage` e `AffiliateCampaign`**:
  - Coluna opcional `offerId` (`offer_id`) ligada a `Offer` (`ON DELETE SET NULL`), mantendo `content.affiliateLink`, `tracking.offerUrl` e `affiliate_campaigns.offer_url` funcionais.
- **`DomainRoutingEvent` (`domain_routing_events`)**:
  - Histórico auditável por conta (`userId`), domínio, presell e oferta: `health_check_passed`, `health_check_degraded`, `health_check_failed`, `auto_failover`, `auto_recovery`, `manual_swap`, `manual_rollback`, `role_changed`, `domain_disabled`, `domain_enabled`, `offer_validated`, `offer_blocked`, `binding_updated`.

#### 2. Isolamento Multi-Tenant, Migration e Backfill Seguro

- **`tenantPrisma.ts`**: Registo obrigatório de `offer`, `presellDomainBinding`, `offerDomainBinding` e `domainRoutingEvent` em `USER_ID_MODELS`.
- **Migration SQL + `rollback.sql`**:
  - `CREATE TYPE` / `CREATE TABLE` / `ALTER TABLE` idempotentes.
  - Backfill não destrutivo:
    - Domínios `is_default = true` recebem `routing_role = 'primary'`; os restantes **mantêm `standby`** (nunca são promovidos automaticamente — `backup` é opt-in explícito do utilizador); `https_reachable_cached = true` inicializa `health_status = 'healthy'`.
    - Extração idempotente de ofertas a partir de `presell_pages` e `affiliate_campaigns` para `offers` e preenchimento de `offer_id` sem remover campos antigos.
    - Criação de `presell_domain_bindings` `primary` **apenas** a partir de um `custom_domain_id` explícito, verificado e não exclusivo de tracking. Presells com `custom_domain_id` NULL continuam a seguir o domínio padrão da conta, sem binding.
  - `schemaRepair.ts` atualizado com as mesmas proteções idempotentes contra drift em arranque.

#### 3. Integração com Módulos Existentes (Sem Duplicação)

- **Validação de Ofertas (`offerValidation.ts` + `offerService.ts`)**:
  - Reutiliza `assertExternalProductUrl` (`presellImportSsrf.ts`), `isOptOutOrUnsubscribeAnchor` (`mirrorExternalHosts.ts`) e `probeDestinationUrl` (`compliance/destinationProbe.ts`).
  - Bloqueia SSRF, esquemas perigosos, links de opt-out e open-redirects suspeitos **ao salvar** a oferta (só nos campos alterados, para não impedir renomear ofertas legadas importadas). O hop não reaplica heurísticas estritas — hoplinks legados continuam a redirecionar.
  - Sincroniza `Offer.hoplinkUrl` com `tracking.offerUrl` / `content.affiliateLink` e invalida `trackEdgeDestCache`.
- **Roteamento, Saúde e Failover (`domainRoutingService.ts`)**:
  - Reutiliza `probeCustomDomainLiveSsl` (`customDomainLiveSsl.ts`), `rotatorDestinationHealth` / `probeDestinationUrl`, `appendWorkspaceAuditLog` (`workspaceAudit.ts`).
  - Seleção determinística do domínio autorizado por presell (`primary` → `backup` saudável por prioridade; nunca usa domínio desativado, `down`, não verificado ou `purpose='tracking'` como lander).
  - Troca manual de domínio principal e **rollback** para o domínio anterior registado em `DomainRoutingEvent`.
- **Tracking e Edge (`track.controller.ts`, `trackEdgeDestCache.ts`, `presellHostAccess.ts`, `presellLiteHtml.ts`)**:
  - Resolução de destino: o link próprio da presell (`affiliateLink`/`offerUrl`, se http(s)) tem precedência; senão usa o hoplink da `Offer`. O `to=` aceita também o hoplink da oferta (`alternateDestinations`) e o backup validado. Oferta inativa ou bloqueada → `sendSafeVisitorPage`. Rede do hop: plataforma da campanha primeiro, depois a rede declarada na oferta.
  - Editar manualmente o link para algo diferente do hoplink da oferta desliga a presell da oferta (`offer_id = null`), no backend e no editor.
  - **Bindings escolhem o domínio canónico/failover; nunca restringem onde a presell abre.** `/track/*` não consulta bindings (medição essencial nunca bloqueada). Nas rotas públicas da presell, `assertPresellHostBindingAllowed` só recusa um host com binding **explicitamente desativado** nessa presell; qualquer outro domínio do dono continua a servir a Final URL.
  - Pausar um domínio retira-o do roteamento e de links novos, mas ele continua a servir páginas publicadas e a constar no CORS/pixel (`customDomainCache` sem filtro `isActive`).
  - Fallback `P2021`/`P2022` nos leitores críticos (`track.controller.ts`, `presell.controller.ts`, `campaigns.controller.ts`, `trackEdgeDestCache.ts`, `customDomainCache.ts`, `publicApiBase.ts`) garantindo zero quebra durante janelas de deploy.
- **APIs Implementadas**:
  - **Ofertas (`/api/offers`)**: `GET /`, `POST /backfill`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/validate`, `PUT /:id/domains`, `GET /:id/events`.
  - **Domínios (`/api/custom-domain`)**: extensão de `GET /` + novos endpoints `POST /:id/health-check`, `PATCH /:id/active`, `PATCH /:id/routing`, `POST /:id/promote-primary`, `POST /rollback-primary`, `GET /routing-events`.
  - **Presells (`/api/presells`)**: suporte a `offer_id`, `offer`, `domain_bindings` + novos endpoints `GET /:id/domains`, `PUT /:id/domains`, `POST /:id/domains/swap-primary`, `POST /:id/domains/rollback`.
  - **Campanhas (`/api/campaigns`)**: suporte a `offer_id` e resumo `offer`.
- **Frontend Integrado**:
  - `frontend/src/types/api.ts`, `frontend/src/services/offersService.ts`, `customDomainService.ts`, `presellService.ts`, `campaignsService.ts`.
  - `frontend/src/lib/publicPresellOrigin.ts`: ignora domínios `is_active === false` ou `health_status === "down"`, e ordena `domain_bindings` (`primary` → `backup` → `standby` por prioridade).
  - `frontend/src/components/settings/CustomDomainSettings.tsx`: badges de saúde/papel/pausa, teste de saúde sob demanda, pausar/reativar sem remover DNS/Vercel, troca de papel, promoção a primário, rollback e histórico de eventos de roteamento.
  - `frontend/src/components/offers/OffersRegistryPanel.tsx` (integrado em `CampaignsPage.tsx`): criação/edição/validação/pausa/remoção de ofertas, backfill idempotente a partir de presells/campanhas e propagação segura de hoplink.
  - `frontend/src/components/presell/PresellDomainBindingsControl.tsx` (integrado em `PresellDashboard.tsx`): seleção opcional de `Offer` associada e gestão por presell de domínios autorizados (`primary` + `backup`), troca rápida de primário e rollback.

#### 4. Ficheiros de Migração e Rollback

- Migração aditiva e idempotente: `backend/prisma/migrations/20261128100000_smart_domain_routing_offers/migration.sql`
- Script explícito de reversão DDL: `backend/prisma/migrations/20261128100000_smart_domain_routing_offers/rollback.sql`
- Reparação idempotente de drift no arranque: `backend/src/lib/schemaRepair.ts` (`repairSmartDomainRoutingSchema`)

#### 5. Riscos Conhecidos e Salvaguardas Aplicadas

- **Aplicação da migration em produção**: O script `start:prod` no Railway executa `prisma migrate deploy` antes de iniciar `node dist/server.js`; ainda assim, todas as queries críticas possuem fallback para `P2021`/`P2022` caso haja janelas transitórias.
- **Mudança de Final URL em anúncios ativos**: Como regra de conformidade Google Ads, trocar um domínio primário atualiza os links gerados no painel e protege novas configurações, mas **não** injeta `301/302` entre domínios nem muta campanhas remotas no Google Ads automaticamente (o assistente de Final URL da Etapa 4 só sugere; a alteração é sempre feita pelo utilizador no Google Ads).
- **Execução do backfill**: O backfill automático SQL ocorre na migration e pode também ser reexecutado sob demanda e de forma idempotente via `POST /api/offers/backfill` (botão *Importar das presells* na interface).

---

### Auditoria pós-Etapa 1 (Concluída)

Correções aplicadas antes de avançar:

- Removida a verificação de bindings em `/track/*` e tornadas não-bloqueantes as rotas públicas (só um binding explicitamente desativado recusa o host) — evitava 404 em cliques pagos com Final URL noutro domínio do dono.
- `customDomainCache` e a presell-raiz deixaram de filtrar `isActive` — pausar um domínio não pode partir CORS, pixel nem páginas já publicadas.
- Migration: removido o `UPDATE standby → backup` e o binding automático de presells sem domínio explícito.
- Hop: sem validação estrita no redirect; precedência do link da presell sobre o hoplink da oferta; `to=` aceita o hoplink da oferta.
- Troca de domínio no editor passou a alinhar os bindings de forma síncrona (`alignPresellBindingsWithLegacyDomain`) em vez de um swap em segundo plano.
- O gate de compliance só é reposto quando o link da oferta muda de facto.
- Renomear ofertas legadas importadas já não falha por validação de campos não alterados.
- `health_check_passed` passou a ser o evento de verificação bem-sucedida (`auto_recovery` fica reservado à recuperação automática real).
- Painel de continuidade: presells sem domínio explícito passam a ser avaliadas contra o domínio padrão *configurado* da conta (antes, um backup já selecionado escondia o risco de o padrão estar em baixo).
- Rollback na UI: o botão só aparece quando o backend o aceitaria (eventos de conta e domínio anterior ≠ atual).
- Editor da presell: autorizar um backup numa presell sem bindings semeia primeiro o domínio atual (ou o padrão da conta) como primário — antes, o backup tornava-se primário e mudava o domínio da página.

---

### Etapa 2 — Monitorização Contínua de DNS, SSL e HTTP com Alertas (Concluída)

- **`backend/src/lib/domainHealthMonitor.ts`**: cron (`node-cron`, registado em `server.ts` via `registerDomainHealthMonitor()`) que seleciona domínios verificados vencidos (`selectDomainsDueForHealthCheck`), com intervalo normal e intervalo curto de re-verificação enquanto há falhas, concorrência limitada (`runWithConcurrency`) e dependências injetáveis para testes.
- **Sonda em 3 camadas** (`runDomainHealthProbeAndUpdate`, em paralelo): DNS (`probeDomainDns`, A/AAAA/CNAME, timeout 2,5 s), SSL/TLS (`probeCustomDomainLiveSsl`) e HTTP (`probeRotatorDestinationQuick`). `summarizeDomainProbeLayers` indica a primeira camada a falhar (`DNS: …`, `SSL/TLS: …`, `HTTP: …`).
- **Histórico compacto**: só são gravados em `DomainRoutingEvent` as falhas, as transições de estado e as verificações manuais (`shouldRecordHealthEvent`). O uptime é calculado a partir das transições.
- **Multi-réplica**: cada domínio é reclamado de forma atómica (`updateMany` condicionado a `lastHealthCheckAt`) e um guard em processo impede ciclos sobrepostos.
- **Alertas** (`domainContinuityAlerts.ts`): `domain_down` / `domain_recovered` / failover / recuperação por e-mail (`saleNotifyEmail` ou e-mail da conta), Telegram (se ativo na conta) e web push (link para `/configuracoes/dominio#continuidade`). Cooldown de 30 min por chave. Todas as mensagens afirmam que os anúncios não foram alterados.

### Etapa 3 — Failover Automático e Auto-Recovery (Concluída)

- **`backend/src/lib/domainFailover.ts`** (planeadores puros + executores):
  - Após `DOMAIN_HEALTH_FAIL_THRESHOLD` falhas consecutivas (default 3) o domínio passa a `down` e o monitor dispara `executeFailoverForDownDomain`.
  - **Conta**: se o domínio em baixo é o padrão (lander), promove o domínio com papel `backup` de maior prioridade que esteja `healthy`, verificado, ativo, não-tracking e com HTTPS alcançável. `standby` nunca é usado automaticamente. `unknown`, `degraded` e `down` nunca são destino.
  - **Presell**: presells cujo binding primário é o domínio em baixo passam para o primeiro binding `backup` utilizável (mesmas regras). O anterior fica como backup.
  - **Confirmação ao vivo do destino** (`confirmFailoverTargetLive`): se a última verificação do backup tem mais de 2 min (ou data inválida/futura), o destino é sondado antes da promoção. Se falhar, é excluído (`excludedIds`) e tenta-se o seguinte. Se nenhum passar → `no_backup_available` e nada muda.
  - **Ciclo em duas fases**: o monitor sonda primeiro todos os domínios do lote e só depois executa os failovers, em série. Um backup que caiu no mesmo ciclo já está marcado antes de ser escolhido. Um failover que lance erro conta como erro do ciclo e não interrompe os restantes.
  - Eventos `auto_failover` com `actor_user_id = NULL` (sem auditoria de workspace falsa).
- **Auto-recovery** (`processPendingAutoRecoveries`): volta ao domínio original quando este está saudável há pelo menos `DOMAIN_AUTO_RECOVERY_HOLD_MINUTES` (default 10), tem `auto_recover = true` e o primário atual continua a ser o alvo do failover. Uma troca manual ou rollback posterior cancela a recuperação automática.
- **Conformidade**: o failover muda apenas o domínio canónico usado para links novos e sugestões. Não há 301/302 entre domínios, a página no domínio original continua a ser servida a quem lá chegar (incluindo AdsBot), e nenhum anúncio é alterado.

### Etapa 4 — Painel de Continuidade e Assistente de Final URL (Concluída)

- **API** `GET /api/continuity/overview` (`continuity.controller.ts`, só leitura): configuração do monitor, domínios com uptime 24 h / 7 d, presells em risco (`no_domain`, `primary_down`, `primary_paused`, `on_backup`), sugestões de Final URL, eventos recentes e métricas do monitor. Devolve 503 `CONTINUITY_SCHEMA_PENDING` enquanto a migration não estiver aplicada.
- **Assistente de Final URL** (`domainContinuityPlanner.ts`): analisa a primeira Final URL de cada RSA Google Ads e sinaliza `domain_down`, `domain_paused`, `domain_unverified`, `unknown_host`, `presell_unpublished` e `not_canonical`. A sugestão troca **só o host** por um domínio saudável do dono, mantém caminho e query e remove `gclid` (auto-tagging). Destino: primeiro um domínio `healthy`; `unknown` só se não existir nenhum saudável; `degraded`/`down` nunca. Sem destino, o problema continua sinalizado com `suggestedUrl: null`. Nenhuma escrita é feita na Google Ads: o utilizador copia a URL e altera-a ele próprio.
- **DTO** (`ads.suggestions[]`): todo em camelCase — `rsaId`, `externalAdId`, `campaignName`, `adGroupName`, `currentUrl`, `currentHost`, `issue`, `severity`, `presellId`, `presellTitle`, `suggestedUrl`, `suggestedHost`. Consumidores: `continuity.controller.ts`, `frontend/src/types/api.ts` (`ContinuityOverviewDto`), `DomainContinuityPanel.tsx` e o respetivo teste.
- **Frontend**: `DomainContinuityPanel.tsx` em `/configuracoes/dominio` (âncora `#continuidade`), `continuityService.ts`, tipos `ContinuityOverviewDto`, helpers `continuityDisplay.ts`. Textos de roteamento/ofertas/bindings traduzidos para en, pt, pt-BR e es (`fragments/continuity.*.ts`, em `pages.continuity`).

### Etapa 5 — Observabilidade e Testes de Carga e Resiliência (Concluída)

- **Métricas** (`domainContinuityMetrics.ts`, expostas em `getOpsSnapshot().domain_continuity` e no painel): ciclos, verificações, falhas, erros de sonda, alertas, failovers, recuperações, latência das sondas e latência de failover (primeira falha → failover), resumo do último ciclo.
- **Testes** (`npm run test:continuity`, também incluídos em `test:unit`): seleção e concorrência, alertas por transição, failover e recuperação de ponta a ponta, falhas de sonda sem derrubar o ciclo, claim multi-réplica, guard de sobreposição, carga sintética de 2 000 domínios, camadas DNS/SSL/HTTP com resolver falso.
- **Carga** (`npm run load:continuity`, só leitura, só local/staging via `assertSafeHttpTarget`): mede `GET /api/continuity/overview` e `GET /api/custom-domain`. SLO: erro < 1 % e p95 < `LOAD_TEST_P95_MS` (default 1500 ms).

  ```
  LOAD_TEST_BASE_URL=http://127.0.0.1:3001 LOAD_TEST_EMAIL=... LOAD_TEST_PASSWORD=... \
  LOAD_TEST_VUS=20 LOAD_TEST_REQUESTS=200 npm run load:continuity
  ```

### Variáveis de Ambiente (backend)

| Variável | Default | Efeito |
| --- | --- | --- |
| `DOMAIN_HEALTH_MONITOR_ENABLED` | `true` (desligado com `NODE_ENV=test`) | Liga o cron de monitorização |
| `DOMAIN_HEALTH_MONITOR_CRON` | `*/2 * * * *` | Frequência do ciclo |
| `DOMAIN_HEALTH_CHECK_INTERVAL_MIN` | `10` | Intervalo entre verificações de um domínio saudável |
| `DOMAIN_HEALTH_RECHECK_INTERVAL_MIN` | `2` | Intervalo enquanto o domínio está a falhar |
| `DOMAIN_HEALTH_MONITOR_BATCH` | `60` | Máximo de domínios por ciclo |
| `DOMAIN_HEALTH_MONITOR_CONCURRENCY` | `4` (máx. 32) | Sondas em paralelo |
| `DOMAIN_HEALTH_FAIL_THRESHOLD` | `3` (1–20) | Falhas consecutivas até `down` + failover |
| `DOMAIN_HEALTH_HTTP_TIMEOUT_MS` | `8000` (1000–30000) | Timeout da camada HTTP da sonda; timeout/erro de rede repete uma vez antes de contar como falha |
| `DOMAIN_AUTO_FAILOVER_ENABLED` | `true` | Liga o failover automático |
| `DOMAIN_AUTO_RECOVERY_HOLD_MINUTES` | `10` (1–1440) | Estabilidade exigida antes de voltar ao original |
| `DOMAIN_HEALTH_ALERTS_ENABLED` | `true` | Envio de alertas |

### Invariantes de Conformidade (verificados em código e testes)

- Medição essencial (`/track/r/`, pixel, impressões) nunca depende de bindings, pausa de domínio nem consentimento.
- Nenhum domínio serve conteúdo diferente por IP/UA/bot; AdsBot vê sempre a Final URL real.
- Nenhum 301/302 automático entre domínios de Final URL; nenhuma escrita na Google Ads a partir da continuidade.
- `gclid` / `gbraid` / `wbraid` / UTMs / SubIDs preservados no hop (`gad_source` registado no clique); sugestões de Final URL sem `gclid` manual.

### Verificação contra Postgres real (base descartável local)

Executada num Postgres 14 temporário, nunca na base de produção:

- As 75 migrações aplicam-se em sequência numa base vazia.
- `rollback.sql` reverte tudo (tabelas, colunas e enums) e `migration.sql` volta a aplicar-se sem erros nem duplicados (idempotente).
- Backfill sobre dados legados: só o domínio padrão e o de tracking recebem `primary`; os restantes ficam `standby`; ofertas deduplicadas (links `#` ignorados); bindings apenas para presells com domínio explícito, verificado e de hosting; campos legados intactos.
- `prisma migrate diff` não mostra desvios nas colunas e tabelas novas (apenas o `DEFAULT` de `updated_at`, inofensivo e igual ao de outras tabelas).
- Executores reais de failover/recuperação: failover de conta e de presell, idempotência (segunda execução não faz nada), janela anti-flapping respeitada, recuperação automática após a janela, ciclo completo do monitor e `GET /api/continuity/overview`.

### Riscos Residuais

- As métricas do monitor são por processo (cada réplica mostra as suas); o histórico durável está em `DomainRoutingEvent`.
- O failover automático só atua se o utilizador tiver marcado pelo menos um domínio como `backup` (conta) ou autorizado backups na presell. Sem isso, o sistema alerta mas não troca nada.
- Anúncios ativos com Final URL num domínio em baixo continuam a apontar para ele até o utilizador aplicar a sugestão do assistente no Google Ads.

### Teste ponta a ponta na app real (base descartável local, revalidado após reinício da máquina)

Backend (`:3101`) e frontend (`:5273`, `VITE_API_URL` apontado ao backend local) contra Postgres 14 descartável, com conta, planos, domínios, oferta, presells e campanha Google Ads de teste. Cada passo abaixo foi observado no browser, na API ou na base.

- **Alinhamento backend/frontend (`account_fallback`):** quando todos os bindings de uma presell estão indisponíveis, o backend agora cai para o domínio padrão da conta (a mesma cadeia que o frontend já usava). Antes devolvia `none_available` e o painel mostrava "Sem domínio utilizável" mesmo com um domínio saudável. Coberto por testes unitários.
- **Monitor:** DNS/SSL/HTTP reais; domínio inalcançável passa a `down` após 2 falhas consecutivas.
- **Failover automático:** primário `down` → backup saudável vira primário (domínio e presell); o standby nunca é usado.
- **Auto-recuperação:** com o nome original de volta, após o período de espera, o domínio e a presell regressam ao original, com evento `auto_recovery` por scope.
- **Ações manuais na UI:** pausar/ativar oferta foi testado nesta base (gravou `is_active`; o hop reagiu: pausada → 403 com página neutra sem hoplink; ativa → 302). Promover a primário (`manual_swap`) e rollback (`manual_rollback`) foram testados na sessão anterior, antes do reinício da máquina, com eventos gravados e o painel a refletir a troca.
- **Assistente de Final URL:** sugere o mesmo caminho e query no domínio ativo, remove `gclid`, não altera nada automaticamente. Corrigido: se o caminho aponta para uma presell que não existe na conta, **não** se inventa URL (antes sugeria uma página que podia dar 404).
- **Conformidade do funil público:** a presell pública devolve o mesmo corpo para utilizador, AdsBot, Googlebot, Google-InspectionTool e facebookexternalhit. O hop `/track/r/` faz um único 302 para o hoplink, preservando `gclid`, `gbraid`, `wbraid` e UTMs (com `gad_source` registado no clique), idêntico para humanos e bots. Pixel e impressão respondem 200. Um domínio pausado continua a aceitar medição (CORS).
- **Segurança das rotas:** rotas de continuidade e ofertas exigem autenticação (401 sem token) e não recebem CORS de origens fora da allowlist.
- **Copy:** o risco de presell legada passou de "Primário offline" para "Domínio configurado offline" (presells sem bindings usam o domínio configurado, que pode ser um backup), nas quatro locales.
- **Editor de presell — domínios autorizados (failover/backup):** "+ Autorizar backup", "Remover backup", "Tornar primário" e "Rollback" persistem em `presell_domain_bindings`, mostram toast e atualizam o link público. Verificado na UI: backup autorizado; failover automático do monitor (primário offline → backup `example.net` a primário, link público atualizado); troca manual de volta para `example.com` com o anterior preservado como backup. Um "não persiste" anterior foi causado pela base de teste (ids de domínio não-UUID); com UUIDs reais o fluxo funciona.
- **Save do editor não reverte o primário:** o formulário só envia `custom_domain_id` quando o utilizador alterou o domínio nessa sessão de edição. Antes, um editor aberto antes de um failover (ou troca noutro separador) gravava o domínio antigo ao guardar, desfazendo o failover em silêncio. Após troca pelo controlo de bindings, o valor de referência é atualizado.
- **Sessão (`AuthContext`):** `refreshUser` deixou de terminar a sessão em qualquer erro de `/auth/me`. Só um 401 limpa a sessão. Uma falha transitória (backend reiniciado, offline) mantém o utilizador autenticado. Coberto por `AuthContext.test.tsx` e verificado com backend reiniciado.

Limitações conhecidas desta verificação:

- A presell raiz do domínio (`/` sem presell raiz configurada) responde 404 igual para humanos e bots; não foi testada uma raiz com presell configurada.
- Presells de tipo não-lite (ex.: `cookies`) fazem um 302 **dentro do mesmo host** para a página SPA (`/<slug>`), igual para todos os user agents.
- O console do browser não foi exportado linha a linha; a verificação cobriu erros visíveis e os fluxos acima.

### Ronda de consistência — fecho de riscos (base descartável local)

Regras introduzidas nesta ronda:

- **Gate de troca e rollback** (`describeUnavailablePrimaryTarget`, usado por `planPrimaryDomainSwap` e `planRollbackTarget`): recusa destinos `down`, `degraded` (mostra o último erro de saúde) e `unknown` sem HTTPS alcançável (SSL inválido, expirado ou em falta). A recusa devolve **HTTP 409** (presell e conta) com mensagem explícita, por exemplo "Rollback recusado: o domínio anterior (lp-b.test) está indisponível (down). Último erro: DNS: ENOTFOUND. O domínio atual mantém-se.", e não altera nenhum estado.
- **Failover só para destinos saudáveis**, com confirmação ao vivo e ciclo em duas fases (ver Etapa 3).
- **Sessão revogada por conta apagada:** `resolveLiveWorkspaceClaims` (usado por `authenticate` e `authenticateJwtOrApiKey`) exige que a conta do actor exista. Um JWT bem assinado de uma conta apagada recebe 401 em todas as rotas autenticadas, e não só em `/auth/me` (que também passou de 404 para 401). O preview público de presell no domínio principal usa `resolveWorkspaceMembershipClaims` (sem essa consulta), porque as presells de uma conta apagada já não existem (cascade).
- **UI:** badge "Degradado" nos bindings da presell; ao guardar uma presell publicada que o servidor pausou por conformidade, o toast diz que foi pausada, em vez de "continua publicada".

Resultados observados na app real (backend `:3101`, frontend `:5273`, Postgres 14 descartável):

| Cenário | Resultado |
| --- | --- |
| Editor aberto + failover automático + guardar conteúdo | Primário promovido (`example.net`) mantém-se; único evento `auto_failover` |
| Rollback para domínio offline / SSL expirado; troca para SSL autoassinado; rollback de conta para domínio em baixo | 409 com mensagem clara; estado da base idêntico antes/depois |
| DTO de Final URL | Chaves camelCase na API viva; painel mostra "Atual"/"Sugerida" corretamente |
| Principal e backups em falha no mesmo ciclo | Nenhuma promoção (0 `auto_failover`); backup com verificação antiga sondado ao vivo e rejeitado |
| Reinício do backend | Bindings, presells, papéis de domínio e eventos de auditoria idênticos (diff vazio) |
| Assistente sem domínio saudável | `suggestedUrl: null`; com `example.com` saudável volta a sugerir só a troca de host |
| Conta apagada com JWT válido | 401 em `/auth/me`, `/presells`, `/continuity/overview`; a sessão do dono não é afetada |
| `JWT_SECRET` rodado com a aba aberta | Primeiro pedido recebe 401 → token e utilizador limpos → `/auth`; arranque com token antigo idem |

Testes de regressão adicionados: `domainRoutingService.test.ts` (gate degraded/SSL/down, mensagens de rollback), `domainFailover.test.ts` (falha simultânea, `excludedIds`), `domainHealthMonitor.test.ts` (failover após todas as sondas, failover com erro), `domainContinuityPlanner.test.ts` (nunca sugere degradado; `unknown` só como recurso), `workspaceSessionGuard.test.ts` (conta apagada → `SessionUserGoneError`), `AuthContext.session.test.tsx` (401 real em `/auth/me` e noutra rota termina a sessão; 503 mantém-na), `DomainContinuityPanel.test.tsx` (DTO camelCase).

### Fecho das pendências de produção

- **Sondas afinadas:** timeout HTTP configurável (`DOMAIN_HEALTH_HTTP_TIMEOUT_MS`, default 8 s, antes fixo em 3 s) e uma nova tentativa em timeout/erro de rede (`probeDomainHttpWithRetry`). Respostas HTTP (5xx) não repetem; domínios realmente em baixo continuam a falhar. Em ~11 min de monitor real, `example.com`/`example.net` tiveram 0 falhas (antes ficavam `degraded` de forma intermitente).
- **Revogação de sessões no servidor** (migration `20261128160000_user_sessions_revoked_at`, aditiva e idempotente, com `rollback.sql`; também em `scripts/ensure-pro-columns.ts`): `users.sessions_revoked_at`. JWTs emitidos antes do corte recebem 401 `SESSION_REVOKED`; a comparação é ao milissegundo pela claim `iatMs` (tokens antigos sem `iatMs` usam `iat` em segundos). Revoga: troca de senha (devolve token novo para a sessão atual), reposição de senha (o link passa a ser de uso único) e `POST /api/auth/sessions/revoke-others` (botão "Terminar sessões noutros dispositivos" em `/conta`). Sem a coluna, o guard autentica sem revogação em vez de derrubar sessões.
- **Ordem de arranque em produção** (`start-production.sh`): `ensure-pro-columns` → `prisma migrate deploy` → API. Verificado na base descartável: sem a coluna o login falha (503); o `ensure` repõe-na; o `migrate deploy` seguinte aplica a migration sem erro.
- **Alertas reais (e-mail):** com SMTP local, o monitor enviou "Domínio indisponível" (por domínio, com cooldown) e "Failover automático — lp-a.test → example.net", com a frase "Os anúncios não foram alterados" e link para o painel. Telegram e web push dependem de credenciais reais (bot / VAPID) e usam o mesmo despacho.
- **Duas réplicas reais** (`:3101` e `:3102`, mesma base, mesmo cron): cada domínio verificado uma vez por ronda (4 + 1), um único `auto_failover` por âmbito (conta e presell), revogação de sessão respeitada em ambas.
- **Failover com backup de prioridade mais alta indisponível:** `lp-b.test` (prioridade 5, em falha) foi ignorado; promovido `example.net` (prioridade 10, saudável), na conta e na presell.
- **Presell raiz de domínio:** `GET /api/public/custom-domain/root-presell` devolve 200 com corpo idêntico para utilizador, AdsBot, Googlebot e Google-InspectionTool; domínio sem raiz → 404 neutro.
- **Auto-pausa por conformidade:** mantida (salvaguarda de política). O toast avisa no momento do save e o assistente de Final URL marca o anúncio como "Presell não publicada", por isso o risco fica visível no painel de continuidade.

### O que depende do dono da conta

- **Deploy:** as migrations `20261128100000_smart_domain_routing_offers` e `20261128160000_user_sessions_revoked_at` aplicam-se sozinhas no arranque do contentor (`start-production.sh`). Fazer backup da base antes do deploy.
- **Variáveis:** `SMTP_*` ou `RESEND_API_KEY` + `SMTP_FROM` para os alertas por e-mail; opcionalmente `DOMAIN_HEALTH_HTTP_TIMEOUT_MS` e `DOMAIN_HEALTH_FAIL_THRESHOLD`.
- **Na app:** marcar pelo menos um domínio como `backup` (conta) e autorizar backups nas presells com tráfego pago; sem isso o sistema alerta mas não troca nada.

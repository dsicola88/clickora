# Paid Autopilot — produto hoje vs roadmap

Documento único para **equipa** e **investidores**: o que o módulo já faz, o que é parcial, e para onde faz sentido evoluir.  
Arquitectura técnica detalhada: [PAID-ADS-ARCHITECTURE.md](./PAID-ADS-ARCHITECTURE.md).

---

## 1. Proposta de valor (uma frase)

**Reduzir trabalho manual nas redes e decisões às cegas**, ao combinar **criação guiada de campanhas**, **limites de segurança**, **modo Copilot ou Autopilot**, e um **motor de optimização** que actua sobre dados do próprio tracking e APIs das plataformas — com **auditoria** das decisões.

---

## 2. O que já existe no produto

| Dimensão | Estado |
|----------|--------|
| **Criação de campanhas (Google / Meta / TikTok)** | Fluxos «Nova campanha» no dpilot (`/tracking/dpilot/p/:id/...`), planos gerados com IA ou lógica determinística, **rascunhos** e pedidos até à rede. |
| **Ligação às contas** | OAuth por plataforma; sem ligação não há publicação. |
| **Controlos de risco** | **Guardrails** (orçamentos, geo, palavras bloqueadas, etc.) definidos por projecto. |
| **Modo de trabalho** | **Copilot** (aprovação humana antes ou conforme política) vs **Autopilot** (aplicação automática dentro dos limites). |
| **Motor automático (Optimizer V0)** | Ciclo em background: métricas de **tracking** + gasto **Google/Meta/TikTok** onde disponível; **pausa** campanha em condições definidas; **escala orçamento** por ROAS (com guardrails + **cap mensal de conta**); **redistribuição** entre campanhas da mesma rede (vencedor ← laggard, gasto total inalterado); **flag** para revisão de criativo (CTR baixo). |
| **Auditoria** | Tabela `paid_ads_optimizer_decisions`, UI «Auditoria & motor», API paginada; logs estruturados `paid.optimizer`. |
| **Alertas opcionais** | Webhook JSON ou formato Slack legacy (`PAID_OPTIMIZER_ALERT_*`). |

---

## 3. Matriz de capacidades (expectativa vs realidade)

| Promessa natural | Realidade técnica |
|------------------|-------------------|
| «Cria campanhas nas plataformas» | **Sim**, através dos assistentes + aplicação na rede quando OAuth e políticas permitem. |
| «Decide alterações» | **Parcial.** Decisões **regra-based** no optimizer (pausa, escala, redistribuição, flag CTR) + sugestões de mensagem a partir do copy existente. Não substitui julgamento estratégico (nova oferta, canal ou positioning). |
| «Aplica mudanças automaticamente» | **Sim** em Autopilot + optimizer **live** (`PAID_OPTIMIZER_DRY_RUN=false`, etc.). Em Copilot, **aprovações** podem ser obrigatórias. |
| «Acompanha resultados» | **Sim** operacionalmente: tracking, decisões registadas, lista na auditoria. Não substitui um BI externo completo. |
| **Pausar campanha inteira** | **Sim** (optimizer + APIs). |
| **Aumentar orçamento** | **Sim ao nível da campanha** (escala ROAS), respeitando tetos. **Redistribuição** entre campanhas live da mesma rede (corta no laggard, soma no vencedor). Cap mensal de conta bloqueia só escala líquida. |
| **Criar novas campanhas** | **Sim** pelos fluxos existentes; não é o optimizer a criar campanhas sem input estruturado. |
| **Mudar abordagem** | **Parcial.** Flag de criativo orienta revisão; **mudança de estratégia de marketing** não está automatizada como motor único. |

---

## 4. Pré-requisitos para o motor funcionar «de verdade»

- Migrações aplicadas (incl. `paid_ads_optimizer_decisions`, `optimizer_flags` em campanhas).
- `PAID_OPTIMIZER_ENABLED=true` no servidor API.
- Tracking com **ligações correctas** aos IDs de campanha (`paid_ads_campaign_id` / `campaign` nos eventos).
- Para mutações na rede em produção: `PAID_OPTIMIZER_DRY_RUN=false` **apenas** quando a equipa aceitar o risco e tiver monitorização.

---

## 5. Roadmap sugerido (prioridades típicas)

| Horizonte | Entrega incremental |
|-----------|------------------------|
| **Curto** | ✅ Dashboard «saúde» por projecto (`GET /paid/projects/:id/health-summary` + card na Visão); ✅ alertas por email em paralelo ao webhook (`alerts.service` + `PAID_OPTIMIZER_ALERT_EMAIL` opcional). |
| **Médio** | ✅ Cap mensal ao nível conta (`maxMonthlySpendMicros` → bloqueia escala + decisão `block_scale`); ✅ TikTok spend no optimizer (`report/integrated/get` + `resolveSpendUsd`); ✅ redistribuição activa entre campanhas (`reallocate_budget`, mesma rede, neutra em gasto). |
| **Longo** | ✅ MVP A/B criativo **Copilot**; ✅ medição por anúncio na rede + ranking; ✅ recomendações mensagem/oferta (`message-recs`: determinístico + LLM opcional, grava rascunhos Meta/RSA sem inventar funil/claims). |

---

## 6. Riscos e transparência (investidores / compliance)

- **Performance marketing não é garantia de ROI** — o sistema reduz erro operacional e acelera reacção a dados; não elimina risco de mercado ou criativo fraco.
- **Claims públicos** («melhor que humanos», «totalmente automático») devem ser evitados ou qualificados: aqui o valor é **escala**, **auditoria** e **consistência**, não substituição de estrategas seniores em todos os contextos.
- **Plataformas terceiras** (Google, Meta, TikTok) mudam APIs e políticas — manutenção contínua é custo real.

---

## 7. Google Ads vs Meta vs TikTok — na Clickora vs fora da app

Orientação rápida para equipa/comunicação honesta (**não são percentagens fixas**; dependem de modo Copilot/Autopilot, OAuth e servidor).

### 7.1 O que esperar da automação dentro do produto

| | **Google Ads (Search)** | **Meta** | **TikTok** |
|---|--------------------------|----------|------------|
| **Ligação de conta** | OAuth + Customer ID gravados na ligação | OAuth + seleção/referência ao Ad Account | OAuth + advertiser em contexto |
| **Rascunho / plano** | IA ou fallback RSA + grupos/chaves (assistido) | IA ou fallback Meta (campanha, conjunto, criativos texto) | Plano TikTok gravado como campanha local |
| **Publicação pela API quando Autopilot passa guardrails** | `google-ads.publish`: cria recurso Search (campanha, grupo, RSA, conforme modelo) (`GOOGLE_ADS_DEVELOPER_TOKEN` exigido) | `meta-ads.publish`: cria campanha ACTIVE + conjunto + anúncios Graph **se** página Facebook (`META_PROMOTED_PAGE_ID` / `META_PAGE_ID` ou `page_id`) estiver configurada | `tiktok-ads.publish`: **cria apenas campanha + ad group** remoto (`advertiser_id`); **Anúncios em vídeo** na API TikTok ficam como passos posteriores (o ficheiro de publish não faz upload criativo vídeo aqui — ver código) |
| **Guardrails que bloqueiem autopublish** | Orçamentos, geo, keywords bloqueadas, etc., por projeto | Idem onde aplicável (conforme rotas Meta) | Idem TikTok onde implementado |

### 7.2 O que típico continuar a mexer/recortar nas UIs das próprias redes

| Área típica fora ou depois da Clickora | Google | Meta | TikTok |
|----------------------------------------|--------|------|--------|
| **Compliance e conta** | Níveis conta, método pagamento faturação, políticas marcação conversões próprios domínios | Revisões de especial ad categories DSA quando aplicável, Business Manager | Conta publicitária aprovada, brand safety |
| **Criativo e formato** | Extensões, rótulos de marca no Google; Merchant se shopping (fora escopo Search simples aqui) | Ajustar criativo carousel/vídeo, verificar rejeições de moderação | **Vídeo e ad** granular: com o nível actual da API só campanha+ad group ficam garantidos pela app — completar vídeo criativo onde for preciso na TikTok Ads |
| **Medição paralela** | Tag site / GMC conforme modelo de conta | Pixel / CAPI lado Meta (o produto liga workflows de vendas no tracking; não substitui toda conta de Medições) | Pixel/app events TikTok segundo política conta |

Esta matrix serve para mensagem interna («não prometer campanhas vídeo TikTok só com um botão») e evita confundir «pipeline bem estruturado» com «90 % automático ponta‑a‑ponta».

---

## 8. Referências no código

| Área | Local principal |
|------|-----------------|
| Motor optimizer | `backend/src/paid/optimizer/` |
| Creative swap Copilot | `backend/src/paid/creativeSwap.service.ts` + rotas `…/creative-swap/*` |
| Ranking criativo (rede) | `creativeRanking.ts` + `meta-metrics.fetchMetaAdInsights` + `google-metrics.fetchGoogleAdGroupAdMetrics` |
| Redistribuição orçamento | `optimizer/reallocate.engine.ts` + decisão `reallocate_budget` no tick |
| Mensagem/oferta Copilot | `messageOfferRecs.ts` + `…/creative-swap/message-recs` |
| Rotas Paid API | `backend/src/routes/paid.routes.ts` |
| UI dpilot | `frontend/src/pages/dpilot/` |
| Gate staging Paid | `npm run test:staging-paid-autopilot-gate` (incl. creative-swap + reallocate contracts) |

---

*Última actualização: roadmap curto/médio/longo fechados no núcleo optimizer+Copilot (redistribuição, ranking, message-recs); §2–§5.*

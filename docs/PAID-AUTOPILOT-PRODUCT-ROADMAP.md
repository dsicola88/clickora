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
| **Motor automático (Optimizer V0)** | Ciclo em background: métricas de **tracking** + gasto **Google/Meta** onde disponível; **pausa** campanha em condições definidas; **escala orçamento** por ROAS (com guardrails); **flag** para revisão de criativo (CTR baixo). |
| **Auditoria** | Tabela `paid_ads_optimizer_decisions`, UI «Auditoria & motor», API paginada; logs estruturados `paid.optimizer`. |
| **Alertas opcionais** | Webhook JSON ou formato Slack legacy (`PAID_OPTIMIZER_ALERT_*`). |

---

## 3. Matriz de capacidades (expectativa vs realidade)

| Promessa natural | Realidade técnica |
|------------------|-------------------|
| «Cria campanhas nas plataformas» | **Sim**, através dos assistentes + aplicação na rede quando OAuth e políticas permitem. |
| «Decide alterações» | **Parcial.** Decisões **regra-based** no optimizer (pausa, escala, flag CTR). Não substitui julgamento estratégico (mudar oferta, canal ou positioning). |
| «Aplica mudanças automaticamente» | **Sim** em Autopilot + optimizer **live** (`PAID_OPTIMIZER_DRY_RUN=false`, etc.). Em Copilot, **aprovações** podem ser obrigatórias. |
| «Acompanha resultados» | **Sim** operacionalmente: tracking, decisões registadas, lista na auditoria. Não substitui um BI externo completo. |
| **Pausar campanha inteira** | **Sim** (optimizer + APIs). |
| **Aumentar orçamento** | **Sim ao nível da campanha** (escala ROAS), respeitando tetos. Orçamento «global» ao nível conta inteira como política única **não** está como feature isolada — roadmap. |
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
| **Curto** | Dashboard único de «saúde» por projecto (spend vs conversões vs decisões); alertas por email em paralelo ao webhook. |
| **Médio** | Políticas de **alocação** entre campanhas ou orçamento «cap» ao nível conta; TikTok gasto por API no optimizer se API estável. |
| **Longo** | Experimentação **A/B** de criativos com ciclo fechado; recomendações de **mensagem/oferta** assistidas por modelo (sempre com revisão/humano onde exigido por política ou marca). |

---

## 6. Riscos e transparência (investidores / compliance)

- **Performance marketing não é garantia de ROI** — o sistema reduz erro operacional e acelera reacção a dados; não elimina risco de mercado ou criativo fraco.
- **Claims públicos** («melhor que humanos», «totalmente automático») devem ser evitados ou qualificados: aqui o valor é **escala**, **auditoria** e **consistência**, não substituição de estrategas seniores em todos os contextos.
- **Plataformas terceiras** (Google, Meta, TikTok) mudam APIs e políticas — manutenção contínua é custo real.

---

## 7. Referências no código

| Área | Local principal |
|------|-----------------|
| Motor optimizer | `backend/src/paid/optimizer/` |
| Rotas Paid API | `backend/src/routes/paid.routes.ts` |
| UI dpilot | `frontend/src/pages/dpilot/` |

---

*Última actualização do documento: alinhado ao estado do repositório quando o Optimizer V0, auditoria API e alertas webhook foram integrados.*

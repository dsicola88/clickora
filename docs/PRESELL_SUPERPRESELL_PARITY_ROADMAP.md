# Roadmap: ganhar do SuperPresell na parte de **presell**

Última actualização: 2026-11-08  
Âmbito: **só landers / criação / validação de página** — não tracking, postbacks nem Paid Autopilot.

### Entregue nesta data
**A1 + C1 + C3 lite + fábrica (velocidade / modelos / leveza / 3 variantes)**
- `POST /presells/:id/generate-review-copy` — IA + fallback; ângulos `landing|review|advertorial`
- `POST /presells/:id/spawn-variant-pack` — 3 páginas (tsl + review + advertorial); **1** crédito IA se LLM
- Tipo `advertorial` no catálogo
- Wizard: interruptor «Pacote 3 variantes» + auto-texto após criar
- Painel: Gerar review IA · Pacote 3 variantes · score · suggestions · reprovação
- Leveza: sem crédito plataforma se rodapé afiliado off; `content-visibility` no rodapé editorial
- Quota mensal 8/40/120 + rate limit 20/15min

Critério de vitória: um afiliado de Google Ads consegue, **sem WordPress**, criar e validar uma presell **mais rápido e com melhor resultado percebido** do que no SuperPresell Ultimate.

---

## Estado actual (Clickora vs SuperPresell) — auditado 2026-11-08

| Área | Clickora hoje | SuperPresell | Gap |
|------|---------------|--------------|-----|
| Import / espelho da oferta | Forte (mirror + sanitize + offer click) | Bom | ≈ empate; white falha em hops BuyGoods sem URL produto |
| Tipos (cookies, fantasma, review, gates, advertorial) | Forte | Forte | ≈ empate |
| A/B + rotador + pack 3 (33/33/34) | Forte | Variações de tipo | Clickora à frente no pack+rotator SaaS |
| Conformidade interna (gate CT/OC/CL) | Forte + painel Ads | Marketing «anti-bloqueio» | Clickora mais honesto/estruturado |
| Rodapé limpo (opcional) | Feito (`showAffiliateTrustFooter`) | Página limpa por defeito | Fechado |
| **IA review real** | `generate-review-copy` + OpenAI + fallback + quota 8/40/120 | IA no plugin WP | **Fechado no código**; falta deploy prod + OPENAI estável |
| **3 variantes** | `spawn-variant-pack` + wizard | 1 clique | **Fechado no código** |
| Hotmart | Checkout assinatura + webhook + postback afiliado | Link afiliado colado (não SaaS) | Diferente: Clickora = billing + tracking, não plugin WP |
| Validação domínio (Safe Browsing) | Probe + IP blacklist | Análise de domínio | **Médio** |
| Colar reprovação Google → plano | Suggestions + mapDisapproval | Assistente dedicado | **Médio** (C3 parcial) |
| Página leve / LCP como produto | SPA + export HTML | WP “site normal” 98+ claim | **Médio** (B3/B4) |
| Tipografia / look «webdesign profissional» | Temas + artigo editorial white/black; hop→enrich | Templates WP | **Fechado no código** (white sem mirror = artigo profissional) |
| Destino / domínio | Probe DT-* na UI + HTTPS/redirects | Safe Browsing claim | **Fechado lite** (sem API Google externa) |
| LCP / HTML lite | content-visibility export + badge perf_lite | Claim 98+ | **Fechado lite** |

OpenAI: usado em **presell copy** (`presellReviewCopy`) + paid/ads/keywords.

---

## Os 3 pilares (mínimo para dizer “ganhámos”)

### Pilar A — Fábrica de copy com IA
**Objectivo:** colar link → em &lt; 60s ter review útil (e opcionalmente 2–3 ângulos).

| Sprint | Entrega | Dependências | Done when |
|--------|---------|--------------|-----------|
| **A1** | `POST /presells/:id/generate-copy` (ou no wizard): LLM escreve review a partir do extract da oferta; fallback determinístico se não houver `OPENAI_API_KEY` | Reutilizar padrão `paid/messageOfferRecs` + extract de `presellImporter` | Página review publicada com texto original ≥ limiar OC-002 sem espelho como único corpo |
| **A2** | Wizard: «Gerar 3 variantes» → landing / review / advertorial (+ rotador 33/33/34 opcional) | A1 + tipo `advertorial` ou template builder | 1 clique cria 3 pages + URL de teste |
| **A3** | Qualidade multi-idioma (EN/ES/DE prioritários) + guardrails (sem cura, sem fabricante oficial) | A1 + compliance CT/CL | Testes + amostragem humana em 3 idiomas |
| **A4** | Review com vídeo: procurar YouTube do produto (não inventar) | Search API / oEmbed | Modelo “review+vídeo” só quando existir vídeo real |

### Pilar B — Página Ads-ready leve no domínio do afiliado
**Objectivo:** a landing parece site de afiliado limpo, rápida, no domínio custom.

| Sprint | Entrega | Dependências | Done when |
|--------|---------|--------------|-----------|
| **B1** | Layout «artigo review» limpo (hero + corpo + CTA) como default do tipo review com IA | A1 | Screenshot side-by-side vs SP sem chrome SaaS |
| **B2** | Políticas auto no domínio custom (privacidade/termos/contacto) a partir do operador **quando o rodapé estiver ligado**; default continua limpo | Domínios já existentes | Links `/privacidade` etc. no host do afiliado, não só dclickora.com |
| **B3** | Modo «lite» no domínio: HTML estático ou SSR mínimo da lander (ou CDN cache agressivo do export) | Export `presellExportHtml` | LCP alvo documentado (ex. &lt; 2.5s 4G) medido em E2E |
| **B4** | Score de performance da presell no painel (LCP/peso imagens) | B3 + script perf | Badge «pronta a anunciar» inclui perf |

### Pilar C — Validar e corrigir como o SuperPresell
**Objectivo:** antes e depois da reprovação, o afiliado sabe o que fazer.

| Sprint | Entrega | Dependências | Done when |
|--------|---------|--------------|-----------|
| **C1** | UI: mostrar `suggestions` do `correctionAssistant` + score único «Página Ads» (fundir elite + compliance gate) | Já existe backend | Um ecrã com nota 0–100 e lista de acções |
| **C2** | Análise de domínio: Safe Browsing / listas públicas + HTTPS + DNS no custom domain | API Google Safe Browsing ou equivalente | Relatório «domínio OK / risco» com refresh (cooldown tipo 7 dias opcional) |
| **C3** | «Reportar reprovação»: colar texto (+ print opcional) → plano estruturado (causa provável + passos na Clickora) | LLM + mapeamento para regras CT/OC/DT | Fluxo E2E com 3 mensagens reais de reprovação |
| **C4** | Revalidar após correção (1 clique) e diff do fingerprint | Audit jobs | Gate volta a `ready_for_review` sem publicar à cegas |

---

## Ordem recomendada (90 dias)

```
Semanas 1–3   A1 + C1     (IA review + suggestions na UI)     ← maior diferencial percebido
Semanas 4–6   A2 + B1     (3 variantes + layout artigo)
Semanas 7–9   C2 + C3     (domínio + assistente reprovação)
Semanas 10–12 B3 + A3 + B4 (lite/LCP + idiomas + score perf)
```

A4 (vídeo YouTube) pode ir em paralelo após A1.

---

## O que já temos (não reinventar)

- Import/espelho: `backend/src/lib/presellImporter.ts`, mirror snapshot/rehost  
- Tipos + cookies/fantasma: `presellTypeOptions`, `PublicPresell`  
- Conformidade: `backend/src/compliance/*`, painel `PresellAdsCompliancePanel`  
- Correction assistant (backend): `correctionAssistant.ts` — **expor na UI**  
- Rodapé opcional: `showAffiliateTrustFooter`  
- Domínio custom + export HTML  
- Padrão LLM já no monólito: `backend/src/paid/messageOfferRecs.service.ts` (copiar o envelope, não o produto Ads)

---

## O que é preciso para chegar a este nível

### Produto / engenharia
1. **Chave OpenAI (ou modelo) estável em produção** só para presell, com quota e fallback determinístico.  
2. **Prompt + schema** de review (secções fixas, claims bloqueados, idioma).  
3. **Tipo ou template advertorial** + fluxo «gerar 3».  
4. **UI unificada** de score + suggestions + reprovação.  
5. **Integração Safe Browsing** (ou parceiro) para domínio.  
6. **Serve lite** da lander no custom domain (perf).  
7. **Testes**: unitários de copy/guardrails + E2E wizard «link → 3 variantes → publish» + fixtures de textos de reprovação Google.

### Ops / negócio
- Budget LLM por plano (Starter limitado; Pro/Anual generoso).  
- Copy legal: IA **não garante** aprovação (igual ao disclaimer actual de conformidade).  
- Domínios: afiliado continua a precisar de domínio próprio (como no SuperPresell + WP).

### Critérios de aceitação «nível SuperPresell+»
- [ ] Criar review IA a partir do hoplink em &lt; 60s (P50).  
- [ ] Gerar 3 variantes + URL de teste sem sair do wizard.  
- [ ] Domínio custom com score de risco + página com score Ads.  
- [ ] Colar reprovação → ≥ 3 passos accionáveis mapeados à Clickora.  
- [ ] Lander review limpa (rodapé off) com LCP documentado no alvo.  
- [ ] Afiliado de teste (interno) prefere o fluxo Clickora ao SuperPresell em blind test de criação.

---

## Fora de âmbito deste roadmap

Tracking Cloud/Real, postbacks, sync Google Ads conversions, MFA, white-label B2B — a Clickora já compete noutro campo; não são necessários para «ganhar na presell», mas reforçam a retenção depois.

---

## Próximo passo concreto

Começar por **A1 + C1** no mesmo sprint: IA review com fallback + surfacing das suggestions de conformidade. É o maior salto de percepção com o menor risco de arquitectura (LLM pattern já existe; compliance já existe).

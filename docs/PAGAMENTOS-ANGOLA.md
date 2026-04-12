# Pagamentos e Angola — estratégia para o Clickora

Este documento resume **opções reais** para vender o produto quando **Stripe não está disponível** (comum em Angola) e como o código do projeto encaixa.

> **Aviso:** regras bancárias e de plataformas mudam. Confirma sempre no site oficial do fornecedor e com o teu contabilista.

---

## 1. Porque Stripe costuma falhar

O Stripe **restringe** contas de comerciante por país. Muitos criadores em **Angola** não conseguem abrir conta Stripe para receber como empresa individual da mesma forma que nos EUA/UE. Por isso o painel do Clickora **não depende** de Stripe para o fluxo principal de vendas: o desenho previsto é **checkout noutra plataforma** + **webhook** para ativar a assinatura na app.

---

## 2. Hotmart (recomendado no teu caso)

- **Função:** o cliente **paga na Hotmart**; depois a Hotmart chama o teu backend em `POST /api/webhooks/hotmart`.
- **No projeto:** já implementado (`backend/src/controllers/webhook.controller.ts`): cria/atualiza utilizador, faz `upsert` da assinatura, envia e-mail de boas-vindas (se SMTP estiver configurado).
- **Angola:** há relatos de produtores angolanos a usarem a Hotmart como **produtores**; limitações podem existir para **afiliados** em certos mercados. Valida na [Central de Ajuda Hotmart](https://help.hotmart.com) o teu perfil (país, documentos, payout).

**Configuração essencial (Railway / `.env`):**

| Variável | Função |
|----------|--------|
| `HOTMART_WEBHOOK_TOKEN` | Mesmo segredo que configurares no webhook Hotmart (header `x-hotmart-hottok`). |
| `HOTMART_PLAN_MAP` | JSON: códigos de **produto/oferta** Hotmart → `free_trial` \| `monthly` \| `quarterly` \| `annual` (tipos dos planos na tua BD). |
| `HOTMART_DEFAULT_PLAN_TYPE` | Plano usado se o mapa não tiver o código (ex. `monthly`). |
| `HOTMART_PRODUCT_URL` ou `PUBLIC_CHECKOUT_URL` | URL da **página de vendas** Hotmart — usada no botão “Subscrever” na app quando o plano é pago (checkout externo). |
| `HOTMART_PLAN_CHECKOUT_URLS` | (Opcional) JSON `{"plan_monthly":"https://...","plan_annual":"https://..."}` se tiveres **uma página por plano**. |

Fluxo profissional: **1 produto Hotmart por oferta** (mensal / anual) ou **uma página** com várias ofertas e um único `HOTMART_PRODUCT_URL`.

---

## 3. Outras plataformas (Monetizze, Kiwify, Eduzz, Braip…)

- **No código:** não há webhook dedicado para cada uma; só Hotmart está integrada.
- **Caminhos possíveis:**
  - **Zapier / Make / n8n:** evento “compra aprovada” → `POST` ao teu endpoint (seria preciso um segundo endpoint genérico ou reutilizar lógica semelhante à Hotmart).
  - **Desenvolvimento:** duplicar o padrão do `webhook.controller.ts` com parser do JSON de cada plataforma.

Gateways **pan-africanos** (para **checkout próprio** no futuro, com desenvolvimento):

- **Debito Pay**, **PaysGator** (mencionados para vários países africanos — confirma cobertura Angola e API).
- **Verto** (foco em transferências FX/negócio — não é substituto direto 1:1 da Hotmart).

Estes exigiriam **integração de API própria** (não está no roadmap atual do repo).

---

## 4. O que o Clickora faz hoje (resumo)

| Situação | Comportamento |
|----------|----------------|
| Plano **gratuito** (`price_cents === 0`) | O utilizador pode mudar de plano **dentro** da app (`/plans/subscribe`). |
| Plano **pago** | A app **redireciona** para `HOTMART_PRODUCT_URL` (ou URL por plano), em vez de Stripe. |
| Compra concluída na Hotmart | Webhook ativa/atualiza a **assinatura** na base de dados. |

---

## 5. Checklist antes de “abrir vendas”

1. Planos criados na BD (seed ou admin) com `type` alinhado ao `HOTMART_PLAN_MAP`.
2. Webhook Hotmart apontando para `https://<tua-api>/api/webhooks/hotmart` com token correto.
3. Teste com compra de teste / sandbox Hotmart (se disponível) ou valor mínimo.
4. SMTP configurado para e-mail de boas-vindas com senha provisória.
5. `FRONTEND_URL` correto para links no e-mail e CORS.

---

## Referências úteis

- [Hotmart — vendas internacionais](https://blog.hotmart.com/en/blog/how-international-sales-work-at-hotmart) (blog oficial)
- Ajuda Hotmart: webhooks e produtos — [help.hotmart.com](https://help.hotmart.com)

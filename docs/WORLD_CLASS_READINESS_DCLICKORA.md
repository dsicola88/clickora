# DClickora — readiness de produto (nível mundial)

**Actualizado:** 2026-10-31  
**Âmbito:** alinhamento frontend ↔ backend, ledger de conversões, rotadores, i18n de landers, documentação.

Este documento é a **fonte de verdade operacional** sobre o que está pronto para escala internacional e o que permanece fora do perímetro “sem risco”.

---

## 1. Ledger unificado de conversões (ads)

| Origem | TrackingEvent(`conversion`) | Tabela `conversions` | Meta CAPI / TikTok | Google Ads upload |
|--------|----------------------------|----------------------|--------------------|-------------------|
| Postback afiliado (`/integrations/affiliate-webhook`) | Sim (fluxo próprio) | Sim (`createConversion`) | Sim (quando configurado) | Quando GCLID + sync activo |
| `POST /track/postback/google-ads` | Sim | Sim (`google_ads:{tx}`) | **Não** (skipped_ads_direct) | Sim (`syncDirectGclid…`) |
| `POST /track/postback/microsoft-ads` | Sim | Sim (`microsoft_ads:{tx}`) | **Não** | N/A |

**Porquê:** Relatórios / Resultados leem `Conversion`. Antes, Google/Microsoft só escreviam TE → dual store. Agora o mesmo sale aparece no ledger sem disparar CAPI cruzado (evita atribuição falsa Meta/TikTok a partir de um postback Google).

**Idempotência:** `@@unique([userId, externalOrderId])` + dedupe TE por `transaction_id` no metadata.

Código: `backend/src/lib/unifiedAdsConversion.ts`, `track.controller` postbacks.

---

## 2. Sticky session no rotador

| Campo | Comportamento |
|-------|----------------|
| `TrafficRotator.stickySession` (`sticky_session`) | Default `false` — sem mudança para rotadores existentes |
| Modos | Só `weighted` e `random` |
| Cookie | `clk_rs_{rotatorIdCompact}` = arm UUID, `Path=/`, `Max-Age=30d`, `SameSite=Lax` |
| Falha de saúde | Se sticky arm falha probe → escolhe outro elegível |
| Sequential / fill_order | Cookie ignorado (rodízio / fill intactos) |

UI: toggle em **Rotadores** (desactivado nos modos não aplicáveis).

---

## 3. Frontend ↔ backend

| Superfície | Contrato |
|------------|----------|
| Rotadores CRUD | `sticky_session` no DTO create/update/list |
| Track redirect | Lê/escreve cookie sticky; `forwardAdQueryToUrl` em `/r/` e `/rot/` |
| Ads postbacks | Resposta inclui `conversion_id` + `conversion_created` |

---

## 4. Idiomas (landers / VSL)

Strings de UI das **presells públicas** vivem em `frontend/src/lib/presellUiStrings*.ts` (pt-BR, en, es, de, fr, it, pl, tr, nl, sv, no, da, hi, ar + RTL).

O **painel de app** (dashboard) permanece em português europeu/brasileiro de produto; labels críticos de rotadores incluem EN lado a lado onde o operador internacional lê o modo (weighted / sticky).

---

## 5. Documentação organizada

| Doc | Função |
|------|--------|
| [INDICE_DOCUMENTACAO_DCLICKORA.md](./INDICE_DOCUMENTACAO_DCLICKORA.md) | Porta de entrada |
| [ARQUITETURA_DCLICKORA.md](./ARQUITETURA_DCLICKORA.md) | Mapa técnico |
| [AUDITORIA_MASTER_END_TO_END_DCLICKORA.md](./AUDITORIA_MASTER_END_TO_END_DCLICKORA.md) | Evidência A→J |
| **Este ficheiro** | Contrato de readiness + gaps honestos |

---

## 6. Gaps residuais (honestos — não bloqueiam o ledger/sticky)

1. **Envio real Meta CAPI / TikTok** em produção exige tokens + pixels válidos (não mock).
2. **DNS / SSL** de domínio custom depende do provedor (Vercel) e verificação humana.
3. **Sticky “enterprise”** (device graph / IP+UA fingerprint / regras por geo) não está neste cookie; o cookie 1.º partido cobre o caso Voluum-like standard.
4. **Multi-região activa-activa** (failover de edge global) é infra, não app code.
5. **Pack completo de i18n do dashboard** (todas as páginas admin em EN/ES/…) ainda não é um produto separado — landers sim.

---

## 7. Verificação rápida

```bash
cd backend && npx prisma migrate deploy
npm run test:unit   # inclui sticky + unifiedAdsConversion
# Auditoria local (Postgres efémero + API :3011): scripts audit-fase-c / audit-fase-f
```

Critérios C10 / F7 passam quando TE **e** `conversions` incrementam no postback ads.

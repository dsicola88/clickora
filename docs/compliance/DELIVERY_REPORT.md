# Relatório de entrega — Conformidade de presells (Google Ads / Microsoft Advertising)

**Data:** 2026-10-15  
**Versão de regras:** `ads-compliance-2026.10.15`

## 1. Diagnóstico inicial

Stack: React/Vite + Express/Prisma/Postgres. Publicação = `PresellStatus` (`draft|published|paused|archived`) via create/`PATCH /status`. Sem motor de política de landing pages; SSRF forte na importação; cloaking empresarial (geo) distinto de revisão de ads; sem filas Redis (cron in-process).

Falhas relevantes encontradas:

- Publicação imediata no wizard/builder sem revisão de conteúdo original.
- Padrão bridge (imagem+nome+CTA) possível e publicável.
- Sem gate server-side de conformidade.
- Sem painel de evidências/recomendações por plataforma.

## 2. Políticas oficiais consultadas (2026-10-15)

Ver [POLICY_SOURCE_REGISTER.md](./POLICY_SOURCE_REGISTER.md).

- Google: Destination requirements, Insufficient original content, Misrepresentation, Policies overview — **acessíveis**.
- Microsoft Apex 60280 e hub Relevance & Quality EN — **unreachable** nesta consulta; Agreement PDF + pilot CN PDF + Report a Concern — usados com limitações documentadas.

## 3. Problemas no Clickora (antes)

Sem auditoria unificada; publish sem gate; risco elevado de páginas ponte; confiança excessiva em `publishable` do import (hint cliente).

## 4. Ficheiros alterados / criados (motivo)

- `docs/compliance/*` — políticas versionadas e relatório
- `backend/src/compliance/*` — motor, probe SSRF-safe, tracking probe, serviço, correções, testes
- `backend/prisma/schema.prisma` + migração `20261015120000_presell_compliance_audits`
- `presell.controller.ts` / `presell.routes.ts` / `presellCompliance.controller.ts` — gate + API
- `frontend` — painel Conformidade, service types, wizard/builder/dashboard

## 5. Migrações

`20261015120000_presell_compliance_audits` — ADD columns + tabelas (não destrutiva). Sem DROP de dados.

## 6. UI

Secção **Conformidade publicitária** no editor (dashboard): estados Google/Microsoft, FAIL/WARNING/NOT_CHECKED, evidências, reauditoria, contestação humana, campos de identidade/privacidade/afiliado. Sem selos “Approved”.

## 7. Testes (executados nesta entrega)

| Comando | Resultado |
|---------|-----------|
| `cd backend && npm run test:unit` | **290 pass / 0 fail** (inclui 30 testes de conformidade + SSRF) |
| `cd backend && npx tsc --noEmit` | **OK** |
| `cd frontend && npm run lint` | **OK** (0 errors; 3 warnings pré-existentes noutros ficheiros) |
| `cd frontend && npm run build` | **OK** |
| Migração local `prisma migrate deploy` | **Não aplicada** — o `.env` local aponta para Railway remota inacessível neste ambiente; aplicar em deploy com `npm run api:db:migrate:deploy` |

Cenários 1–23 do pedido cobertos em `backend/src/compliance/evaluate.test.ts` + `destinationProbe.test.ts`.

## 8. Limitações / pendências

- Hub EN Microsoft incompleto → META-001 WARNING (não bloqueia sozinho).
- Probe de destino é HTTP HEAD/GET sem JS; crawlers AdsBot reais não são emulados 1:1.
- Cloaking geo (`enterpriseCloak`) falha DT-007 por precaução — pode exigir override humano em casos legítimos de compliance geo.
- Assistente de correção **não** gera factos nem políticas fictícias.
- E2E Playwright dedicado à conformidade: pendente (padrão existente noutras áreas).

## 9. Produção

1. Deploy API + `prisma migrate deploy`
2. Egress HTTPS para probes
3. Sem novas env vars obrigatórias
4. Revalidar registo de políticas >90 dias

## 10. Validação manual

Ver checklist em [README.md](./README.md).

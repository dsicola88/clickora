# Conformidade publicitária (presells)

Sistema de **verificações internas** do Clickora para reduzir risco de reprovação evitável em Google Ads e Microsoft Advertising.

**Isto não garante aprovação** nem impede suspensões. A UI e a API usam linguagem explícita (sem “Google Approved” / “100% antibloqueio”).

## Documentação

| Ficheiro | Conteúdo |
|----------|----------|
| [POLICY_SOURCE_REGISTER.md](./POLICY_SOURCE_REGISTER.md) | URLs oficiais, datas, status |
| [GOOGLE_ADS_POLICIES.md](./GOOGLE_ADS_POLICIES.md) | Mapa operacional Google |
| [MICROSOFT_ADVERTISING_POLICIES.md](./MICROSOFT_ADVERTISING_POLICIES.md) | Mapa operacional Microsoft + limitações de acesso |
| [EXAMPLES.md](./EXAMPLES.md) | Exemplos bloqueados / ready / needs_review |
| [DELIVERY_REPORT.md](./DELIVERY_REPORT.md) | Relatório de entrega desta implementação |

## Fluxos cobertos

Criação (wizard, dashboard, builder), importação URL, duplicação, edição, `PATCH /status` → `published`. Todos passam pelo motor `backend/src/compliance`.

## API

- `GET /api/presells/compliance/rules`
- `GET /api/presells/:id/compliance`
- `POST /api/presells/:id/compliance/audit`
- `POST /api/presells/:id/compliance/decisions` (falso positivo / disputa)

Publicar (`status=published`) exige `compliance_gate=ready_for_review` após auditoria no servidor. O frontend **não** decide a gate.

## Estados

`PresellStatus` existente: `draft | published | paused | archived`  
Gate: `unchecked | checking | needs_review | blocked | ready_for_review`

`ready_for_review` = verificações internas OK. **Não** significa aprovado pelo Google/Microsoft.

## Produção

1. `prisma migrate deploy` (migração `20261015120000_presell_compliance_audits`)
2. Rede de saída do API permitida para probes HTTPS de destinos (com SSRF guard)
3. Sem novas secrets obrigatórias
4. Revalidar `POLICY_SOURCE_REGISTER` periodicamente

## Validação manual antes de anunciar

1. Abrir a presell → secção **Conformidade publicitária** → Executar auditoria.
2. Corrigir FAILs (conteúdo, afiliado, identidade, privacidade, claims).
3. Confirmar HTTPS e destino final da oferta no browser.
4. Verificar divulgação de afiliado e política de privacidade visíveis na página pública.
5. Só então publicar e criar o anúncio nas plataformas — esperando a **revisão delas**.

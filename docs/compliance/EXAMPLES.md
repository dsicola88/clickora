# Exemplos de gates de conformidade

## Bloqueada (`blocked`)

**Cenário:** imagem + nome + botão para o vendedor; ~20 palavras; sem divulgação nem contacto.

| Regra | Resultado |
|-------|-----------|
| OC-001 | FAIL |
| OC-002 | FAIL |
| CT-001 | FAIL |
| CT-002 | FAIL |
| PRIV-001 | FAIL |

Publicação via `PATCH .../status` → **403** `COMPLIANCE_GATE`.

---

## Needs review (`needs_review`)

**Cenário:** conteúdo substantivo OK, mas `CL-003` WARNING (estudo sem fonte) ou destino `NOT_CHECKED` crítico.

Publicação bloqueada até correção ou decisão humana auditada (`override_pass` com motivo).

---

## Ready for review (`ready_for_review`)

**Cenário:** texto original ≥ ~150 palavras, divulgação de afiliado, identidade, privacidade, destino HTTPS OK, sem claims críticos, tracking preservado.

Significado: **verificações internas concluídas**. O anúncio ainda pode ser reprovado pelo Google ou Microsoft.

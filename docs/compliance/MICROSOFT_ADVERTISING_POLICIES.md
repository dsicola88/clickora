# Microsoft Advertising — resumo operacional para presells Clickora

**Versão:** `ads-compliance-2026.10.15`  
**Consulta:** 2026-10-15  
**Fontes oficiais:** ver [POLICY_SOURCE_REGISTER.md](./POLICY_SOURCE_REGISTER.md)

Este documento **não** substitui as políticas oficiais da Microsoft. Onde a fonte EN normativa não esteve acessível, o status fica explícito.

## 1. Limitação de acesso (obrigatório)

| URL pedida / tentada | Resultado em 2026-10-15 |
|----------------------|-------------------------|
| https://help.ads.microsoft.com/apex/index/3/en/60280 | Sem conteúdo útil (“nothing matches”) |
| https://about.ads.microsoft.com/en/resources/policies/relevance-and-quality-policies | Página de pesquisa sem corpo normativo |
| https://about.ads.microsoft.com/en/policies/microsoft-advertising-policies | 404 |
| https://about.ads.microsoft.com/en/resources/policies/disallowed-content-policies | 404 |

**Consequência:** regras Microsoft no motor usam apenas fontes recuperáveis (Agreement + PDF de piloto CN + formulário Report a Concern) e podem emitir `WARNING` / `NOT_CHECKED` com confiança reduzida quando a política EN completa estiver `unreachable`.

## 2. Microsoft Advertising Agreement (privacidade)

Fonte: [Agreement PDF](https://help.ads.microsoft.com/resources/microsoft_advertising_agreement/en.pdf)

- Link **proeminente** a política de privacidade em cada destino.
- Conformidade com leis de privacidade aplicáveis (incl. GDPR/ePrivacy quando relevantes).
- Se usar UET ou partilhar dados pessoais com a Microsoft: divulgar na política e linkar a Microsoft Privacy Statement.
- Consentimento quando legalmente exigido antes de ativar UET / partilhar dados.

## 3. Qualidade de destino (PDF piloto CN + Report a Concern)

Fontes: [pilot policy CN PDF](https://help.ads.microsoft.com/resources/microsoft_advertising_policy/microsoft-advertising-pilot-policy-cn.pdf), [Report a Concern](https://about.ads.microsoft.com/en/forms/policies/report-spam-form)

Requisitos operacionalmente alinhados (sem assumir paridade total com política EN):

- Landing page fiável, alinhada com o anúncio; conteúdo de qualidade.
- UX sem surpresas, downloads inesperados ou navegação enganosa.
- Conteúdo de baixa qualidade / bridge / relevância fraca → risco de reprovação.
- Malvertising e conteúdo não permitido → risco elevado.

## 4. Mapeamento → regras Clickora

| Regra | Fonte |
|-------|-------|
| `OC-*`, `DT-*` (plataforma `microsoft`) | `msads-pilot-policy-cn`, `msads-report-concern` |
| `PRIV-001` | `msads-agreement` |
| `META-001` (fonte Microsoft EN) | `msads-apex-60280`, `msads-relevance-quality` → `unreachable` |

## 5. Separação Google vs Microsoft

O motor produz resultados **por plataforma**. Uma passagem interna Google **não** implica conformidade Microsoft, e vice-versa. `READY_FOR_REVIEW` = apenas verificações internas Clickora.

## 6. Limitações

- Sem garantia de aprovação Microsoft.
- Reconsultar o help center oficial quando o hub EN voltar a estar acessível e atualizar este ficheiro + `RULES_VERSION`.

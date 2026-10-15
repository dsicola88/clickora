# Google Ads — resumo operacional para presells Clickora

**Versão:** `ads-compliance-2026.10.15`  
**Consulta:** 2026-10-15  
**Fontes oficiais:** ver [POLICY_SOURCE_REGISTER.md](./POLICY_SOURCE_REGISTER.md)

Este documento **não** substitui as políticas oficiais. É um mapa para o motor de conformidade e para operadores.

## 1. Destination requirements

Fonte: [Destination requirements](https://support.google.com/adspolicy/answer/6368661)

| Tema | O que verificar em presells |
|------|-----------------------------|
| Destination not working | HTTPS, HTTP 2xx/3xx válidos, sem erro para crawlers |
| Destination mismatch | Domínio final coerente; redirects que mudam de domínio sem transparência |
| Destination not crawlable | Não bloquear AdsBot; sem cloaking diferencial |
| Destination not accessible | Geo/paywall que impede o mercado anunciado |
| Destination experience | Sem pop-ups abusivos, downloads forçados, navegação frustrante |
| Insufficient original content | Ver secção 2 |
| Unacceptable URL | Sintaxe válida; sem IP como display URL |

## 2. Insufficient original content

Fonte: [Insufficient original content](https://support.google.com/adspolicy/answer/16427718)

Sinais de risco elevado em Clickora:

- Página com **apenas imagem + nome + botão** para domínio externo (bridge).
- Espelho/scrape do vendedor **sem** valor editorial próprio.
- Texto genérico / placeholder / “under construction”.
- Destino cujo único propósito é enviar o utilizador a outro site.

**Correção:** conteúdo original útil e substantivo; **não** enchimento automático para “passar” a auditoria.

## 3. Misrepresentation

Fonte: [Misrepresentation](https://support.google.com/adspolicy/answer/6020955)

- Identidade comercial clara; sem fingir ser fabricante, médico ou entidade oficial.
- Relação de afiliado divulgada quando aplicável.
- Preços/ofertas/garantias verificáveis; sem inventar.
- Claims irrealistas (resultados garantidos, imediatos, universais).

## 4. Overview (proibido / restrito / práticas)

Fonte: [Google Ads policies](https://support.google.com/adspolicy/answer/6008942)

- **Proibido:** cloaking, bridge pages, malware, conteúdo ilícito, etc.
- **Restrito:** saúde, álcool, jogos, finanças, sexual, etc. — elegibilidade e leis locais.
- **Editorial:** qualidade técnica e de destino.

## 5. Mapeamento → regras Clickora

| Regra | Fonte |
|-------|-------|
| `OC-001` … `OC-004` | `gads-insufficient-original-content`, `gads-destination-requirements` |
| `CT-001` … `CT-003` | `gads-misrepresentation` |
| `CL-001` … `CL-004` | `gads-misrepresentation`, `gads-policies-overview` |
| `DT-*` | `gads-destination-requirements` |
| `DT-007` | `gads-policies-overview` (cloaking) |

## 6. Limitações

- Aprovação final é da Google.
- Revisão humana continua necessária em `NEEDS_REVIEW` e categorias restritas.
- Fontes devem ser revalidadas periodicamente (`META-001`).

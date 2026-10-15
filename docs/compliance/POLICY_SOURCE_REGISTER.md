# Registo de fontes de política (versão 2026-10-15)

Este registo versiona as fontes oficiais usadas pelo motor de conformidade do Clickora.
As regras do código referenciam estes IDs; **não** tratam as políticas como verdades imutáveis.

**Data de consulta:** 2026-10-15  
**Versão do pacote de regras:** `ads-compliance-2026.10.15`

## Como atualizar

1. Reconsultar as URLs oficiais.
2. Atualizar `last_verified_at` e `status` (`current` | `stale` | `unreachable` | `pending_review`).
3. Incrementar `RULES_VERSION` em `backend/src/compliance/policySources.ts`.
4. Ajustar regras afetadas e testes.
5. Documentar o delta neste ficheiro.

Fontes com `last_verified_at` > 90 dias devem marcar `stale` e a regra `META-001` deve emitir `WARNING`.

---

## Google Ads

| ID | Título | URL | Âmbito | Status | Verificado |
|----|--------|-----|--------|--------|------------|
| `gads-destination-requirements` | Destination requirements | https://support.google.com/adspolicy/answer/6368661 | Destino funcional, crawlable, experiência, conteúdo original insuficiente, mismatch de URL | `current` | 2026-10-15 |
| `gads-insufficient-original-content` | Insufficient original content | https://support.google.com/adspolicy/answer/16427718 | Bridge pages, mirroring/scraping, parked/under construction, gibberish | `current` | 2026-10-15 |
| `gads-misrepresentation` | Misrepresentation | https://support.google.com/adspolicy/answer/6020955 | Identidade enganosa, preços desonestos, claims irrealistas, ofertas indisponíveis | `current` | 2026-10-15 |
| `gads-policies-overview` | Google Ads policies (overview) | https://support.google.com/adspolicy/answer/6008942 | Proibido/restrito, práticas proibidas (cloaking, bridge), saúde/finanças/jogos, editorial | `current` | 2026-10-15 |

### Regras relevantes extraídas (resumo operacional)

- Destinos devem funcionar, ser crawlable pelo AdsBot e acessíveis no geo alvo.
- Conteúdo original insuficiente: páginas só para enviar a outro site; espelho/scrape sem valor; templates duplicados; parked/blank.
- Misrepresentation: ocultar identidade/afiliação; claims improbáveis; preços enganosos; ofertas inexistentes.
- Práticas proibidas: cloaking, bridge/gateway pages, malware, arbitragem de ads.
- Categorias restritas (saúde, suplementos, finanças, jogos, etc.) exigem elegibilidade e revisão humana — a deteção automática **não** é decisão legal.

---

## Microsoft Advertising

| ID | Título | URL | Âmbito | Status | Verificado | Notas |
|----|--------|-----|--------|--------|------------|-------|
| `msads-apex-60280` | (índice Apex 60280) | https://help.ads.microsoft.com/apex/index/3/en/60280 | Índice de políticas (pedido original) | `unreachable` | 2026-10-15 | A página devolveu “nothing matches your search”. Não inventar conteúdo a partir deste URL. |
| `msads-relevance-quality` | Relevance and quality (hub) | https://about.ads.microsoft.com/en/resources/policies/relevance-and-quality-policies | Qualidade de destino / relevância | `unreachable` | 2026-10-15 | Fetch devolveu página de pesquisa vazia / sem corpo útil. |
| `msads-agreement` | Microsoft Advertising Agreement | https://help.ads.microsoft.com/resources/microsoft_advertising_agreement/en.pdf | Privacidade no destino, UET, responsabilidade do anunciante | `current` | 2026-10-15 | Exige link proeminente a política de privacidade; consentimento onde a lei o exigir. |
| `msads-pilot-policy-cn` | Microsoft Advertising pilot policy (CN PDF) | https://help.ads.microsoft.com/resources/microsoft_advertising_policy/microsoft-advertising-pilot-policy-cn.pdf | Keywords, ad copy, UX do destino, qualidade de conteúdo | `current` | 2026-10-15 | Documento em chinês; usado apenas para requisitos de qualidade de landing page claramente traduzíveis (bridge/thin content, fiabilidade, match ad↔destino). **Não** assumir paridade 1:1 com a política EN global. |
| `msads-report-concern` | Report a Concern | https://about.ads.microsoft.com/en/forms/policies/report-spam-form | Exemplos de baixo qualidade / malvertising / relevância | `current` | 2026-10-15 | Formulário; confirma categorias de preocupação, não é o texto normativo completo. |

### Regras relevantes documentadas a partir de fontes acessíveis

- Destino estático e fiável; não surpreender o utilizador; navegação previsível; conteúdo alinhado com o anúncio.
- Conteúdo de baixa qualidade: páginas cujo propósito principal é atrair tráfego/ads; passos desnecessários; bridge pages.
- Privacidade: política acessível em cada destino; divulgação de recolha quando se usa UET / se partilha dados com a Microsoft.
- **Limitação:** o hub EN de políticas Relevance & Quality e o Apex `60280` não estavam acessíveis nesta consulta. Regras Microsoft no motor ficam marcadas com fontes `msads-agreement` / `msads-pilot-policy-cn` / `msads-report-concern` e confiança reduzida onde a fonte EN normativa falta.

---

## Categorias reguladas (ponteiro)

Consultar sempre as páginas oficiais da categoria e do mercado alvo antes de anunciar. O motor sinaliza padrões de risco; **não** certifica elegibilidade.

| Área | Google (overview) | Microsoft | Notas Clickora |
|------|-------------------|-----------|----------------|
| Saúde / suplementos | Secção Restricted em `gads-policies-overview` | Pendente fonte EN normativa | Claims de cura/tratamento → FAIL crítico + revisão humana |
| Finanças | Idem | Pendente | Claims de rendimento garantido → risco elevado |
| Jogos de azar | Idem | Pendente | Elegibilidade por país — NOT_CHECKED se mercado não configurado |
| Produtos regulados | Idem | Pendente | Pedir certificação ao utilizador; não inventar |

---

## Aviso do produto

Nenhuma verificação interna garante aprovação pelo Google Ads ou Microsoft Advertising, nem impede suspensões. O Clickora reporta riscos, evidências e limitações.

# Métricas honestas (o que a dclickora mostra)

Nada é inventado. Os números vêm de eventos reais ou de postbacks da rede.

## Fonte de verdade

| Métrica | O que conta | O que **não** conta |
|---------|-------------|---------------------|
| **Cliques** | Eventos `click` reais (sem bots) | Bots/crawlers etiquetados |
| **Impressões / visitas** | Pixel da presell (1× por abertura da página) | Impressões do Google Ads |
| **Vendas / receita** | Postbacks **aprovados** (BuyGoods, etc.) | Eventos `conversion` do script (só telemetria) |
| **País** | GeoIP do IP do visitante | Não inventa país; VPN = país da VPN |
| **Pago vs Orgânico** | Só com ID real (`gclid`, `fbclid`…) | Macros `{gclid}` na URL |
| **ROAS / CPA / lucro** | Receita do período ÷ **gasto Google Ads do mesmo período** | Gasto manual acumulado nas campanhas |

## Porque BuyGoods e dclickora podem diferir

- Medem **sítios diferentes** (página da rede vs. teu tracking).
- VPN muda o país na dclickora.
- Vendas sem `click_id` (UUID) na BuyGoods entram como venda da conta mas **sem** campanha UTM.

## Postbacks

Cada conta tem o **seu** URL de webhook (token por utilizador). Não misturam vendas entre assinantes.

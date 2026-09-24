# Afiliado profissional — o que a dclickora é (e não é)

## Resposta honesta

Para um media buyer que **já** usa Voluum/RedTrack/Binom a €200–400/mês: a dclickora **não substitui** esse tracker.

Para um afiliado profissional de **Google Ads + BuyGoods/Digistore** (presell → hoplink → postback → offline Google): **sim, pode assinar com confiança** se:

1. Usa o URL com tracking da app no anúncio  
2. Configura o postback com `{SUBID}` / UUID  
3. Liga Google Ads (OAuth) ou importa CSV GCLID  
4. Tem domínio próprio (Pro Mensal inclui 1; Anual até 2)

## O que um pro ganha aqui

| Necessidade | Estado |
|-------------|--------|
| Presell rápida + domínio | Sim |
| Clique → UUID no hoplink (BuyGoods subid) | Sim |
| Postback → venda atribuída + rebill | Sim (várias vendas por clique se order_id distinto) |
| Envio Google Ads (API + CSV) | Sim |
| Meta CAPI / TikTok Events | Sim |
| Vendas / receita honestas (sem inventar) | Sim |
| Lucro por **keyword** (utm_term × postback) | Sim |
| Lucro por campanha | Sim |
| Rotador A/B / geo | Sim |

## O que ainda não é Voluum

- Regras avançadas Binom, cost auto-import por clique, heatmaps  
- Keyword P&L com **gasto Google por keyword** cruzado (hoje: receita afiliado por keyword; gasto Google é ao nível da conta)  
- Multi-conta agência completa  

## Checklist BuyGoods (5 minutos)

1. Presell publicada → copiar URL do anúncio (com `utm_term={keyword}` e `gclid={gclid}`)  
2. Plataformas → BuyGoods → Copiar com macros  
3. BuyGoods → Postback Pixel → colar URL  
4. Teste: 1 clique na presell → 1 postback de teste → Relatórios → Conversões «atribuída»  
5. Google Ads → Resumo → Ligar conta (ou CSV offline)

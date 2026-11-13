# Hoplink vs página do produto (Knownwalk / SmartAdv / Everflow)

**Atualizado:** 2026-11-13

## Comportamento (igual BuyGoods / MaxWeb / Digistore)

URLs como:

```text
https://www.knownwalk.com/2MSQQZ2M/22JQ9DB7/
```

são **hoplinks** (Everflow / Knownwalk / SmartAdv). O import:

1. Mantém o hop como **affiliate_link** (CTA / `/track/r/`)
2. Abre o hop no **browser** (Playwright), segue o 302 até à sales page
3. Se o proxy SSRF levar a **Cloudflare 520**, tenta **1× sem proxy** (com `vetImportUrl` em cada request)
4. Espelha / extrai a sales page final (ex. `melaramax.com`)

BuyGoods, MaxWeb e Digistore já faziam redirect+HTML; Knownwalk precisa deste caminho porque o hop em si não serve HTML de produto e o destino costuma bloquear fetch “datacenter”.

## Uso no wizard

| Campo | O quê colar |
|-------|-------------|
| **Hoplink da rede** | `https://www.knownwalk.com/2MSQQZ2M/22JQ9DB7/` |
| **Página do produto** | Opcional — só se o Cloudflare bloquear o hop; ex. `https://melaramax.com/` |

## Código

- `backend/src/lib/presellAffiliateHop.ts` — detecção hop / corpo não-produto
- `backend/src/lib/presellFoldBrowser.ts` — retry sem proxy se CF 520
- `backend/src/lib/presellImporter.ts` — hop → browser → sales page

## Fallback (Cloudflare 520)

Se o hop resolve (302 → melaramax.com) mas o HTML vem bloqueado:

- A presell **ainda é criada** (`import_mode: template`, `publishable: true`)
- `affiliate_link` = Knownwalk
- `source_url` / nome = destino (ex. Melaramax)
- Sem espelho até colares a sales page no 2.º campo (quando o CF permitir)

BuyGoods / MaxWeb / Digistore não mudam.

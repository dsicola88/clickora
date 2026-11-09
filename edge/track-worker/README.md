# Track edge worker (Cloudflare)

Redirect de oferta na edge: 302 imediato a partir do destino em cache; registo do clique em background no origin.

## Fluxo

1. `GET /r/:presellId` no Worker
2. Cache KV/memory do destino (`GET {ORIGIN}/api/track/edge/dest/:presellId`)
3. `302` para a oferta (query string preservada)
4. `POST {ORIGIN}/api/track/click` fire-and-forget com `presell_id` + UTMs

## Variáveis

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `ORIGIN_API_BASE` | sim | Ex. `https://clickora-production.up.railway.app/api` |
| `TRACK_EDGE_SHARED_SECRET` | recomendado | Mesmo valor que no Railway |

## Deploy

```bash
cd edge/track-worker
npm install
npx wrangler login          # uma vez (browser Cloudflare)
# Mesmo valor que TRACK_EDGE_SHARED_SECRET no Railway:
npx wrangler secret put TRACK_EDGE_SHARED_SECRET
npx wrangler secret put ORIGIN_API_BASE
# valor: https://clickora-production.up.railway.app/api
npm run deploy
```

No Railway (já aplicado em 2026-11-09): `TRACK_EDGE_SHARED_SECRET` definido — `GET /api/track/edge/dest/:id` responde 401 sem o header `x-clickora-edge-secret`.

Aponta o CNAME de **tracking** (purpose=`tracking` ou subdomínio dedicado) para o worker. Landers (`purpose=both` / hosting) continuam no Vercel.

## Fallback

Se o dest endpoint falhar, o Worker faz proxy/`302` para `{ORIGIN}/api/track/r/:id` (path completo no origin).

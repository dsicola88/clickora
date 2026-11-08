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
npx wrangler deploy
```

Aponta o CNAME de **tracking** (purpose=tracking) para o worker. Landers continuam no domínio hosting / Vercel.

## Fallback

Se o dest endpoint falhar, o Worker faz proxy/`302` para `{ORIGIN}/api/track/r/:id` (path completo no origin).

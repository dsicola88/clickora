# Track edge worker (Cloudflare)

Hop de oferta na edge, **alinhado ao origin** `GET /api/track/r/:presellId`.

Regista o clique **antes** do 302. Sem `click_id` (guard, falha, IP em falta) ou com cloak geo deny → fallback para o origin (safe page / atribuição completa). **Nunca** abre a oferta sem atribuição.

## Fluxo

1. `GET /api/track/r/:presellId` no Worker  
2. Destino em cache: `GET {ORIGIN}/track/edge/dest/:presellId` (network + cloak)  
3. Cloak geo (`CF-IPCountry` vs `cloak_geo_deny`) → se negado, `302` → origin `/track/r/`  
4. `POST {ORIGIN}/track/click` **sync** com:
   - `presell_id`, UTMs, ads IDs, `parent_click_id`, `redirect_to`, `sub1`–`sub3`
   - `X-Forwarded-For` / `CF-Connecting-IP` = visitante (origin confia via secret — sem `CF-Ray`)
   - `CF-IPCountry` + `x-clickora-edge-secret`
5. `302` para a oferta com:
   - params de rede (`appendClickId`, host + `network` da campanha)
   - ads/UTM selectivos (igual `forwardAdQueryToUrl` no origin)

## Variáveis

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `ORIGIN_API_BASE` | sim | API Railway, ex. `https://clickora-production.up.railway.app/api` — **nunca** o hostname deste Worker |
| `TRACK_EDGE_SHARED_SECRET` | sim (prod) | Mesmo valor que no Railway |

## Deploy

```bash
cd edge/track-worker
npm install
npx wrangler login
npx wrangler secret put TRACK_EDGE_SHARED_SECRET
npx wrangler secret put ORIGIN_API_BASE
# valor: https://clickora-production.up.railway.app/api
npm run deploy
```

No Railway: `TRACK_EDGE_SHARED_SECRET` — `GET /api/track/edge/dest/:id` e o país Cloudflare no `POST /track/click` exigem o header `x-clickora-edge-secret`.

Aponta o CNAME de **tracking** (purpose=`tracking`) para o Worker. Landers continuam no Vercel / hosting.

## Cache

- Memória no isolate: ~60s  
- Origin Redis/memory dest: ~60–120s (`track:edge:dest:v2`)  
- Alterações de hoplink / cloak / network podem demorar até ~2 min a propagar  

## Fallback

Qualquer falha de dest, cloak geo, ou clique → `302` `{ORIGIN}/track/r/:id` + query original. O origin aplica guard, cloak e atribuição completos.

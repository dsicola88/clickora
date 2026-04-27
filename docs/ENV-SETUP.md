# Variáveis frontend ↔ backend (passo a passo)

Objetivo: o browser em **`https://www.dclickora.com`** consegue chamar a API (login, dados) **sem erro CORS**.

## Conceito

| Onde corre | URL típico |
|------------|------------|
| Site (React) | `https://www.dclickora.com` |
| API (Express) | `https://clickora-production.up.railway.app` (ou outro `*.up.railway.app`) |

O browser trata isto como **dois domínios diferentes** → a API tem de enviar cabeçalhos CORS a permitir o origin do site. Isso usa **`FRONTEND_URL`** (e opcionalmente `CORS_ALLOWED_ORIGINS`) na **Railway**.

O frontend precisa de saber **para onde** enviar os pedidos — **`VITE_PUBLIC_API_URL`** ou **`VITE_API_URL`** na **Vercel** (ficam embutidos no JS no build).

---

## A. Railway (serviço da API `clickora`)

1. Abre o serviço → **Variables**.
2. Garante (ajusta valores sensíveis):

| Variável | Valor exemplo | Notas |
|----------|----------------|-------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | *(referência ao Postgres)* | Usar a variável do plugin Postgres se existir. |
| `JWT_SECRET` | *(string longa e secreta)* | |
| `FRONTEND_URL` | `https://www.dclickora.com,https://dclickora.com,https://clickora-five.vercel.app` | **Obrigatório para CORS.** Inclui www, apex e o domínio Vercel de preview se usares. Separa por vírgula, **sem espaços** ou com espaços só à volta (o código faz trim). |
| `API_PUBLIC_URL` | `https://www.dclickora.com/api` **ou** `https://clickora-production.up.railway.app/api` | URLs geradas no servidor (scripts, postbacks). Preferir o domínio do site se o proxy `/api` estiver OK. |
| `CORS_ALLOWED_ORIGINS` | *(opcional)* | Só se precisares de mais origens além do `FRONTEND_URL`. |
| `PUBLIC_API_URL` (ou `API_PUBLIC_URL`) | *(recom. para paid)* | Base HTTPS da API; usada para URLs de callback OAuth. Ver [DEPLOYMENT.md §6](DEPLOYMENT.md) e [PAID-ADS-ARCHITECTURE.md](PAID-ADS-ARCHITECTURE.md). |
| `DPILOTO_PUBLIC_ORIGINS` | *(opcional, legado)* | Origem extra no CORS; o fluxo de anúncios no monólito não depende disto. |
| `PAID_OAUTH_FRONTEND_RETURN_URL` | *(recom. para paid)* | Site para onde o browser volta após OAuth; se vazio, usa o 1.º `FRONTEND_URL`. |

3. **Guardar** e fazer **Redeploy** do serviço (Deploy → Redeploy ou push para `main`).

4. Teste rápido no terminal (substitui o host se for diferente):

```bash
curl -sI -H "Origin: https://www.dclickora.com" "https://clickora-production.up.railway.app/api/health"
```

Deves ver algo como `access-control-allow-origin` na resposta (ou o Express a aceitar o preflight).

---

## B. Vercel (projeto `clickora`, frontend)

1. **Settings** → **Environment Variables**.
2. Para **Production**, define **uma** destas (preferida a primeira):

| Variável | Valor |
|----------|--------|
| `VITE_PUBLIC_API_URL` | `https://clickora-production.up.railway.app/api` |
| ou `VITE_API_URL` | `https://clickora-production.up.railway.app/api` |

3. Usa **HTTPS** e termina com **`/api`**.
4. Se tiveres **Preview** separado, podes usar o mesmo URL da API de produção ou deixar vazio para usar `/api` no domínio do preview (rewrite).

5. **Guardar** e fazer **novo deploy** (Deployments → Redeploy último ou push).

---

## C. Alinhamento obrigatório

- O host em `VITE_PUBLIC_API_URL` (sem `/api`) tem de ser o **mesmo** serviço que o `destination` em `vercel.json` (fallback quando usas `/api` no mesmo domínio).
- Depois de mudar variáveis na Vercel, **sempre** novo build — o Vite injeta no bundle.

---

## D. Erro “não respondeu a tempo” / 502 / 504 no dashboard

O site em **`https://www.dclickora.com`** pode usar **`/api`** (rewrite no `vercel.json` → Railway). O **proxy da Vercel** tem **limite de tempo**; se a Railway **acordar devagar** (cold start) ou a consulta demorar, o browser recebe **504** e a app mostra a mensagem de proxy/gateway.

**Solução:** na Vercel (Production), define **`VITE_PUBLIC_API_URL`** = `https://<o-teu-serviço>.up.railway.app/api` para o JavaScript ir **direto à Railway** (sem passar pelo proxy Vercel). Confirma **CORS** na Railway (`FRONTEND_URL` com o domínio do site) e faz **redeploy** do frontend.

Alternativa: plano Railway com instância sempre quente / menos cold start, para respostas mais rápidas mesmo via `/api`.

---

## E. Se o login ainda falhar (CORS)

1. Confirma no browser (F12 → Network) o **Request URL** e o header **Origin**.
2. Confirma que `FRONTEND_URL` na Railway inclui **exatamente** esse Origin (ex.: `https://www.dclickora.com` com `https`, sem path).
3. Redeploy **Railway** após alterar variáveis.
4. Hard refresh no site (Ctrl+Shift+R) ou janela anónima.

O código do servidor também inclui origens mínimas `www` + apex `dclickora.com` em produção como rede de segurança; mesmo assim mantém `FRONTEND_URL` correto na Railway.

---

## F. Referência rápida

| Onde | Variável | Função |
|------|----------|--------|
| Vercel | `VITE_PUBLIC_API_URL` | Base da API no JavaScript do site |
| Railway | `FRONTEND_URL` | Quem pode chamar a API (CORS) |
| Railway | `API_PUBLIC_URL` | Links absolutos gerados no servidor |

Mais detalhe: [DEPLOYMENT.md](./DEPLOYMENT.md).

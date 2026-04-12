const LOCAL_DEFAULT = "http://localhost:3001/api";

/** Em build de produção sem VITE_API_URL: mesmo domínio que o site (Vercel reescreve /api → Railway). */
const PROD_RELATIVE_DEFAULT = "/api";

function normalizeToApiBase(s: string): string {
  let out = s.trim();
  if (!/^https?:\/\//i.test(out)) out = `https://${out}`;
  out = out.replace(/\/+$/, "");
  if (!/\/api$/i.test(out)) out = `${out}/api`;
  return out;
}

/**
 * Garante URL absoluta. Se `VITE_API_URL` vier sem `https://` (ex.: só o host da Railway),
 * o browser trata como caminho relativo e o pedido vai para o domínio do site — erro 405 no Vercel.
 * Garante sufixo `/api`: o Express monta rotas em `/api/*`; sem isto, `...railway.app` + `/auth/login`
 * bate em `/auth/login` (proxy 502/sem CORS) em vez de `/api/auth/login`.
 *
 * Em produção no Vercel: pedidos a `/api/*` são reescritos para a Railway (vercel.json). Se o build tiver
 * ainda `https://…railway.app` em VITE_API_URL, forçamos `/api` para same-origin (evita CORS no browser).
 *
 * **VITE_API_DIRECT_RAILWAY=true** — usa o URL HTTPS da Railway em `VITE_API_URL` diretamente (sem proxy Vercel).
 * Útil quando o proxy devolve 502 em rotas pesadas. Na Railway, define `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS`
 * com `https://www.dclickora.com` e `https://dclickora.com`.
 */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw === null || !String(raw).trim()) {
    return import.meta.env.PROD ? PROD_RELATIVE_DEFAULT : LOCAL_DEFAULT;
  }
  let s = String(raw).trim();

  const directRailway =
    import.meta.env.VITE_API_DIRECT_RAILWAY === "true" || import.meta.env.VITE_API_DIRECT_RAILWAY === "1";

  if (import.meta.env.PROD && /railway\.app/i.test(s)) {
    if (directRailway) {
      return normalizeToApiBase(s);
    }
    console.info(
      "[clickora] VITE_API_URL apontava para *.railway.app — a usar /api (proxy Vercel → Railway). Para API direta (evitar 502 no proxy): VITE_API_DIRECT_RAILWAY=true e CORS na Railway. Opcional: remove VITE_API_URL no dashboard da Vercel.",
    );
    return PROD_RELATIVE_DEFAULT;
  }
  if (s.startsWith("/")) {
    s = s.replace(/\/+$/, "");
    if (!/\/api$/i.test(s)) {
      s = `${s}/api`;
    }
    return s;
  }
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  s = s.replace(/\/+$/, "");
  if (!/\/api$/i.test(s)) {
    s = `${s}/api`;
  }
  return s;
}

/** Origem do servidor API (sem sufixo `/api`). */
export function getApiOrigin(): string {
  const base = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
  return base.replace(/\/api\/?$/, "");
}

/** Base com `/api` para fetch JSON autenticado (igual ao apiClient). */
export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
}

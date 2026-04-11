const LOCAL_DEFAULT = "http://localhost:3001/api";

/** Em build de produção sem VITE_API_URL: mesmo domínio que o site (Vercel reescreve /api → Railway). */
const PROD_RELATIVE_DEFAULT = "/api";

/**
 * Garante URL absoluta. Se `VITE_API_URL` vier sem `https://` (ex.: só o host da Railway),
 * o browser trata como caminho relativo e o pedido vai para o domínio do site — erro 405 no Vercel.
 * Garante sufixo `/api`: o Express monta rotas em `/api/*`; sem isto, `...railway.app` + `/auth/login`
 * bate em `/auth/login` (proxy 502/sem CORS) em vez de `/api/auth/login`.
 *
 * Em produção no Vercel: usa `VITE_API_URL=/api` (ou deixa vazio → default `/api`) e rewrite `/api/*` → Railway
 * para pedidos same-origin (sem CORS no browser). Evita `https://…railway.app` no build.
 */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw === null || !String(raw).trim()) {
    return import.meta.env.PROD ? PROD_RELATIVE_DEFAULT : LOCAL_DEFAULT;
  }
  let s = String(raw).trim();
  if (import.meta.env.PROD && /railway\.app/i.test(s)) {
    console.warn(
      "[clickora] VITE_API_URL aponta para *.railway.app — o browser faz pedidos cross-origin (CORS). No Vercel: apaga a variável ou define VITE_API_URL=/api para usar o proxy em vercel.json.",
    );
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

const LOCAL_DEFAULT = "http://localhost:3001/api";

/**
 * Garante URL absoluta. Se `VITE_API_URL` vier sem `https://` (ex.: só o host da Railway),
 * o browser trata como caminho relativo e o pedido vai para o domínio do site — erro 405 no Vercel.
 * Garante sufixo `/api`: o Express monta rotas em `/api/*`; sem isto, `...railway.app` + `/auth/login`
 * bate em `/auth/login` (proxy 502/sem CORS) em vez de `/api/auth/login`.
 *
 * Em produção no Vercel: define `VITE_API_URL=/api` e um rewrite `/api/*` → Railway — pedidos ficam
 * same-origin (sem CORS no browser).
 */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw === null || !String(raw).trim()) return LOCAL_DEFAULT;
  let s = String(raw).trim();
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

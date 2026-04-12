const LOCAL_DEFAULT = "http://localhost:3001/api";

/** Fallback quando o site não é dclickora.com (ex.: preview *.vercel.app): mesmo domínio → vercel.json → Railway. */
const PROD_RELATIVE_DEFAULT = "/api";

/**
 * URL público da API em produção — **deve coincidir** com `destination` em `vercel.json` (proxy só como fallback).
 * Pedidos diretos do browser para este host evitam 502 do proxy Vercel em rotas pesadas (analytics, presells).
 */
export const PRODUCTION_RAILWAY_PUBLIC_API = "https://clickora-production.up.railway.app/api";

function normalizeToApiBase(s: string): string {
  let out = s.trim();
  if (!/^https?:\/\//i.test(out)) out = `https://${out}`;
  out = out.replace(/\/+$/, "");
  if (!/\/api$/i.test(out)) out = `${out}/api`;
  return out;
}

/**
 * Base da API para o `apiClient` e `getApiBaseUrl()`.
 *
 * **Produção em www.dclickora.com / dclickora.com:** usa sempre `PRODUCTION_RAILWAY_PUBLIC_API` (API direta na Railway),
 * exceto se `VITE_API_USE_VERCEL_PROXY=true` (força `/api` no mesmo domínio — proxy Vercel).
 *
 * **Preview Vercel / outro host:** sem `VITE_API_URL`, usa `/api` (rewrite). Com URL absoluta, normaliza.
 *
 * **Desenvolvimento:** `http://localhost:3001/api` por defeito.
 */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  if (!import.meta.env.PROD) {
    if (raw === undefined || raw === null || !String(raw).trim()) {
      return LOCAL_DEFAULT;
    }
    return normalizeDevOrExplicitProdUrl(String(raw).trim());
  }

  const forceVercelProxy =
    import.meta.env.VITE_API_USE_VERCEL_PROXY === "true" || import.meta.env.VITE_API_USE_VERCEL_PROXY === "1";

  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const isDclickora = h === "dclickora.com" || h === "www.dclickora.com";
    if (isDclickora) {
      if (!forceVercelProxy) {
        return PRODUCTION_RAILWAY_PUBLIC_API;
      }
      return PROD_RELATIVE_DEFAULT;
    }
  }

  if (raw === undefined || raw === null || !String(raw).trim()) {
    return PROD_RELATIVE_DEFAULT;
  }

  let s = String(raw).trim();

  if (/railway\.app/i.test(s)) {
    if (forceVercelProxy) {
      return PROD_RELATIVE_DEFAULT;
    }
    // Preview (*.vercel.app, etc.): mesmo com URL Railway no env, usar /api no domínio atual (rewrite).
    if (typeof window !== "undefined") {
      const h = window.location.hostname;
      if (h !== "dclickora.com" && h !== "www.dclickora.com") {
        return PROD_RELATIVE_DEFAULT;
      }
    }
    return normalizeToApiBase(s);
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

function normalizeDevOrExplicitProdUrl(s: string): string {
  if (s.startsWith("/")) {
    let p = s.replace(/\/+$/, "");
    if (!/\/api$/i.test(p)) {
      p = `${p}/api`;
    }
    return p;
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

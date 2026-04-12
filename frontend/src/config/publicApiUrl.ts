/**
 * URL base da API pública (termina em `/api`).
 *
 * Definir em **build** (Vercel / CI):
 * - `VITE_PUBLIC_API_URL` — preferido (padrão Vite para variáveis expostas ao cliente)
 * - `VITE_API_URL` — legado, mesmo efeito se o anterior estiver vazio
 *
 * Comportamento:
 * - **Produção sem URL em `www`/`dclickora.com`:** URL Railway em `PRODUCTION_PUBLIC_API_FALLBACK` (evita 502 do proxy Vercel).
 * - **Produção sem URL (outros hosts):** `/api` (same-origin; requer `vercel.json`).
 * - **Produção com URL:** pedidos diretos à API (recomendado para evitar 502 no proxy) — a API deve permitir CORS para o domínio do site (`FRONTEND_URL` na Railway).
 * - **Desenvolvimento sem URL:** `http://localhost:3001/api`
 */

const LOCAL_DEFAULT = "http://localhost:3001/api";
const PROD_SAME_ORIGIN = "/api";

/**
 * Se `VITE_PUBLIC_API_URL` não estiver no bundle (build Vercel sem env visível ao Vite),
 * o fallback era `/api` → proxy Vercel → 502/504. Para o domínio de produção, usar API direta.
 * Sobrescreve sempre com `VITE_PUBLIC_API_URL` se mudares o host na Railway.
 */
const PRODUCTION_PUBLIC_API_FALLBACK = "https://clickora-production.up.railway.app/api";

function isDclickoraProductionHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "www.dclickora.com" || h === "dclickora.com";
}

function readEnvApiUrl(): string {
  const a = import.meta.env.VITE_PUBLIC_API_URL?.trim();
  const b = import.meta.env.VITE_API_URL?.trim();
  return a || b || "";
}

/** Normaliza para terminar em `/api` (caminho absoluto no site ou URL https completa). */
export function normalizeToApiBaseUrl(input: string): string {
  let s = input.trim();
  if (s.startsWith("/")) {
    s = s.replace(/\/+$/, "");
    if (!/\/api$/i.test(s)) s = `${s}/api`;
    return s;
  }
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  s = s.replace(/\/+$/, "");
  if (!/\/api$/i.test(s)) s = `${s}/api`;
  return s;
}

/**
 * Resolve a base da API usada por `apiClient`, `getApiBaseUrl()` e fetches manuais.
 * Não depende de `window` — comportamento determinístico por ambiente de build.
 */
export function getResolvedPublicApiBaseUrl(): string {
  const raw = readEnvApiUrl();

  if (!import.meta.env.PROD) {
    if (!raw) return LOCAL_DEFAULT;
    return normalizeToApiBaseUrl(raw);
  }

  if (!raw) {
    if (isDclickoraProductionHost()) {
      return PRODUCTION_PUBLIC_API_FALLBACK;
    }
    return PROD_SAME_ORIGIN;
  }

  return normalizeToApiBaseUrl(raw);
}

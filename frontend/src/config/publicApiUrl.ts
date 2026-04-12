/**
 * URL base da API pública (termina em `/api`).
 *
 * Definir em **build** (Vercel / CI):
 * - `VITE_PUBLIC_API_URL` — preferido (padrão Vite para variáveis expostas ao cliente)
 * - `VITE_API_URL` — legado, mesmo efeito se o anterior estiver vazio
 *
 * Comportamento:
 * - **Produção em `www`/`dclickora.com`:** usa sempre **`/api`** (same-origin via `vercel.json` → Railway). Não usar URL direta `*.railway.app` no browser — evita CORS, Firefox privado a bloquear, e erros 502 sem `Access-Control-Allow-Origin`.
 * - **Produção (outros hosts, ex. preview Vercel):** `VITE_PUBLIC_API_URL` ou `/api`.
 * - **Desenvolvimento sem URL:** `http://localhost:3001/api`
 */

const LOCAL_DEFAULT = "http://localhost:3001/api";
const PROD_SAME_ORIGIN = "/api";

function isDclickoraSiteHostname(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "www.dclickora.com" || h === "dclickora.com";
}

/** URL da env que aponta para Railway (cross-origin → problemas no browser). */
function isRailwayDirectApiUrl(raw: string): boolean {
  return /\.up\.railway\.app/i.test(raw);
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

  // Site em produção: nunca pedir direto a *.railway.app (CORS / tracking protection / 502 opacos).
  if (isDclickoraSiteHostname() && (!raw || isRailwayDirectApiUrl(raw))) {
    return PROD_SAME_ORIGIN;
  }

  if (!raw) {
    return PROD_SAME_ORIGIN;
  }

  return normalizeToApiBaseUrl(raw);
}

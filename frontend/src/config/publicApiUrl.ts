/**
 * URL base da API pública (termina em `/api`).
 *
 * Definir em **build** (Vercel / CI):
 * - `VITE_PUBLIC_API_URL` — preferido (padrão Vite para variáveis expostas ao cliente)
 * - `VITE_API_URL` — legado, mesmo efeito se o anterior estiver vazio
 *
 * Comportamento:
 * - **Produção em `dclickora.com` ou domínio personalizado no mesmo deploy:** usa **`/api`** (same-origin via `vercel.json` → Railway). Previews `*.vercel.app` podem usar `VITE_PUBLIC_API_URL` explícita.
 * - **Produção (preview Vercel):** `VITE_PUBLIC_API_URL` ou `/api`.
 * - **Desenvolvimento sem URL:** `http://localhost:3001/api`
 */

const LOCAL_DEFAULT = "http://localhost:3001/api";
const PROD_SAME_ORIGIN = "/api";

/** Produção no site real (dclickora ou domínio do afiliado no mesmo projeto), não preview local nem `*.vercel.app`. */
function shouldUseSameOriginApiInProd(): boolean {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.PROD) return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return false;
  if (h.endsWith(".vercel.app")) return false;
  return true;
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
 * Em produção no browser, domínios personalizados (ex.: fastbuyzone.sbs) devem usar **sempre**
 * `/api` no mesmo host — o Vercel reescreve para a Railway. Se `VITE_PUBLIC_API_URL` apontar
 * para outro domínio, os pedidos públicos da presell podem falhar (CORS) ou ir para a API errada.
 */
export function getResolvedPublicApiBaseUrl(): string {
  const raw = readEnvApiUrl();

  if (!import.meta.env.PROD) {
    if (!raw) return LOCAL_DEFAULT;
    return normalizeToApiBaseUrl(raw);
  }

  // Produção no browser: mesmo site que o JS (dclickora.com, www, ou domínio personalizado no projeto Vercel).
  if (typeof window !== "undefined" && shouldUseSameOriginApiInProd()) {
    return PROD_SAME_ORIGIN;
  }

  if (!raw) {
    return PROD_SAME_ORIGIN;
  }

  return normalizeToApiBaseUrl(raw);
}

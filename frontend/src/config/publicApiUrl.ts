/**
 * URL base da API pública (termina em `/api`).
 *
 * Definir em **build** (Vercel / CI):
 * - `VITE_PUBLIC_API_URL` — preferido (padrão Vite para variáveis expostas ao cliente)
 * - `VITE_API_URL` — legado, mesmo efeito se o anterior estiver vazio
 * - `VITE_PUBLIC_TRACK_API_URL` — opcional; pixel/redirect `/track/*` (IP real do visitante)
 *
 * Comportamento:
 * - **Produção em `dclickora.com` ou domínio personalizado:** app autenticada usa **`/api`** (same-origin → Railway).
 * - **Tracking público (pixel, /track/r):** URL absoluta Railway quando possível — o proxy Vercel gravava o IP do hop AWS, não o do visitante.
 * - **Desenvolvimento sem URL:** `http://localhost:3001/api`
 */

const LOCAL_DEFAULT = "http://localhost:3001/api";
const PROD_SAME_ORIGIN = "/api";
/** Mesmo destino que `vercel.json` rewrite — tracking directo para IP correcto. */
const PROD_TRACK_API_FALLBACK = "https://clickora-production.up.railway.app/api";

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
 * Em produção no browser, domínios personalizados usam **`/api`** no mesmo host.
 */
export function getResolvedPublicApiBaseUrl(): string {
  const raw = readEnvApiUrl();

  if (!import.meta.env.PROD) {
    if (!raw) return LOCAL_DEFAULT;
    return normalizeToApiBaseUrl(raw);
  }

  if (typeof window !== "undefined" && shouldUseSameOriginApiInProd()) {
    return PROD_SAME_ORIGIN;
  }

  if (!raw) {
    return PROD_SAME_ORIGIN;
  }

  return normalizeToApiBaseUrl(raw);
}

/**
 * Base da API para pixel, `/track/r/` e beacons — HTTPS directo à Railway
 * para o IP/país do visitante coincidir com BuyGoods/SmartAdv (não o hop Vercel/AWS).
 */
export function getTrackApiBaseUrl(): string {
  const trackOnly = import.meta.env.VITE_PUBLIC_TRACK_API_URL?.trim();
  if (trackOnly) return normalizeToApiBaseUrl(trackOnly);

  const raw = readEnvApiUrl();
  if (raw && /^https:\/\//i.test(raw)) return normalizeToApiBaseUrl(raw);

  if (!import.meta.env.PROD) {
    return getResolvedPublicApiBaseUrl();
  }

  if (typeof window !== "undefined") {
    return PROD_TRACK_API_FALLBACK;
  }

  return getResolvedPublicApiBaseUrl();
}

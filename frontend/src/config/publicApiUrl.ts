/**
 * URL base da API pública (termina em `/api`).
 *
 * Definir em **build** (Vercel / CI):
 * - `VITE_PUBLIC_API_URL` — preferido (padrão Vite para variáveis expostas ao cliente)
 * - `VITE_API_URL` — legado, mesmo efeito se o anterior estiver vazio
 * - `VITE_PUBLIC_TRACK_API_URL` — opcional; pixel/redirect `/track/*` (IP real do visitante)
 *
 * Comportamento:
 * - **Produção em `dclickora.com` ou domínio personalizado:** app e **tracking** (`/track/r`, pixel) usam **`/api`** no mesmo host (rewrite Vercel → Railway; IP via `X-Vercel-Forwarded-For`).
 * - **`VITE_PUBLIC_TRACK_API_URL`:** override (ex. API directa) se precisares de outro hop.
 * - **Preview `*.vercel.app`:** fallback Railway directo no browser.
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
 * Base da API para pixel, `/track/r/` e beacons na **página pública** (browser).
 * Prefer same-origin `/api` no domínio do anúncio — links profissionais (`teudominio.sbs/api/track/r/…`).
 */
export function getTrackApiBaseUrl(): string {
  const trackOnly = import.meta.env.VITE_PUBLIC_TRACK_API_URL?.trim();
  if (trackOnly) return normalizeToApiBaseUrl(trackOnly);

  if (!import.meta.env.PROD) {
    return getResolvedPublicApiBaseUrl();
  }

  if (typeof window !== "undefined" && shouldUseSameOriginApiInProd()) {
    return PROD_SAME_ORIGIN;
  }

  const raw = readEnvApiUrl();
  if (raw && /^https:\/\//i.test(raw)) return normalizeToApiBaseUrl(raw);

  if (typeof window !== "undefined") {
    return PROD_TRACK_API_FALLBACK;
  }

  return getResolvedPublicApiBaseUrl();
}

/** Export HTML / embed: tracking no **mesmo host** da presell publicada (URL absoluta). */
export function getTrackApiBaseForPublicPresell(publicPresellUrl: string): string {
  const trackOnly = import.meta.env.VITE_PUBLIC_TRACK_API_URL?.trim();
  if (trackOnly) return normalizeToApiBaseUrl(trackOnly);
  try {
    const origin = new URL(publicPresellUrl.trim()).origin.replace(/\/+$/, "");
    if (origin) return `${origin}/api`;
  } catch {
    /* fall through */
  }
  return getTrackApiBaseUrl();
}

/**
 * Preferência de domínio de tracking da conta (purpose tracking/both).
 * Usar ao bakear CTAs/embeds quando o afiliado tem `go.marca.com` separado do lander.
 */
export function getTrackApiBaseForAccountDomains(
  domains: Array<{
    hostname: string;
    status: string;
    purpose?: string | null;
    is_default_tracking?: boolean | null;
  }>,
): string | null {
  const trackOnly = import.meta.env.VITE_PUBLIC_TRACK_API_URL?.trim();
  if (trackOnly) return normalizeToApiBaseUrl(trackOnly);
  const eligible = domains.filter(
    (d) =>
      String(d.status).toLowerCase() === "verified" &&
      (d.purpose === "tracking" || d.purpose === "both" || d.purpose == null),
  );
  if (!eligible.length) return null;
  const preferred =
    eligible.find((d) => d.is_default_tracking) ??
    eligible.find((d) => d.purpose === "tracking") ??
    eligible[0];
  if (!preferred?.hostname) return null;
  return normalizeToApiBaseUrl(`https://${preferred.hostname}/api`);
}

/** Export/embed: domínio de tracking da conta se existir; senão host da lander. */
export function resolveTrackApiBaseForExport(
  domains: Array<{
    hostname: string;
    status: string;
    purpose?: string | null;
    is_default_tracking?: boolean | null;
  }>,
  publicPresellUrl: string,
): string {
  return getTrackApiBaseForAccountDomains(domains) ?? getTrackApiBaseForPublicPresell(publicPresellUrl);
}

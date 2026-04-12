/**
 * Compatibilidade e helpers em torno da URL pública da API.
 * Lógica central: `src/config/publicApiUrl.ts`.
 */
import {
  getResolvedPublicApiBaseUrl,
  normalizeToApiBaseUrl,
} from "@/config/publicApiUrl";

export { normalizeToApiBaseUrl };

/** @deprecated Preferir `getResolvedPublicApiBaseUrl()` — mantido para chamadas que ainda passam `raw` manual. */
export function normalizeApiBaseUrl(raw: string | undefined): string {
  if (raw !== undefined && raw !== null && String(raw).trim()) {
    return normalizeToApiBaseUrl(String(raw).trim());
  }
  return getResolvedPublicApiBaseUrl();
}

export function getApiOrigin(): string {
  return getResolvedPublicApiBaseUrl().replace(/\/api\/?$/, "");
}

export function getApiBaseUrl(): string {
  return getResolvedPublicApiBaseUrl();
}

/**
 * Constrói um `URL` para um endpoint sob a base da API.
 * Quando a base é relativa (ex.: `/api` em produção no mesmo domínio), o `URL` precisa de `window.location.origin`.
 */
export function resolveApiUrl(apiBase: string, pathname: string): URL {
  const base = apiBase.replace(/\/$/, "");
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const full = `${base}${p}`;
  if (/^https?:\/\//i.test(full)) {
    return new URL(full);
  }
  if (typeof window === "undefined") {
    throw new Error("resolveApiUrl requires a browser when apiBase is a same-origin path");
  }
  return new URL(full, window.location.origin);
}

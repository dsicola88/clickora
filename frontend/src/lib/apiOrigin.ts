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

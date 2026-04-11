/** Origem do servidor API (sem sufixo `/api`). */
export function getApiOrigin(): string {
  const base = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
  return base.replace(/\/api\/?$/, "");
}

/** Base com `/api` para fetch JSON autenticado (igual ao apiClient). */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || "http://localhost:3001/api";
}

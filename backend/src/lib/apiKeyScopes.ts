export type ApiKeyScope = "read" | "write";

/** Normaliza `scopes` JSON da BD para lista canónica. */
export function normalizeApiKeyScopes(raw: unknown): ApiKeyScope[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<ApiKeyScope>();
  for (const x of raw) {
    if (x === "read" || x === "write") out.add(x);
  }
  return [...out];
}

/** `write` implica leitura. */
export function apiKeyHasScope(scopes: readonly string[], need: ApiKeyScope): boolean {
  if (need === "write") return scopes.includes("write");
  return scopes.includes("read") || scopes.includes("write");
}

/** GET/HEAD/OPTIONS → read; resto → write. */
export function scopeRequiredForHttpMethod(method: string): ApiKeyScope {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return "read";
  return "write";
}

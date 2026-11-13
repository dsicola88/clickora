/**
 * Resolve um destino interno seguro após login (evita open-redirect).
 * Aceita pathname+search+hash relativos (ex.: `/integracoes/google-ads?x=1`).
 */
export function resolvePostAuthRedirect(
  candidate: string | null | undefined,
  fallback = "/inicio",
): string {
  if (!candidate) return fallback;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  // Evitar loop auth ↔ auth
  if (trimmed === "/auth" || trimmed.startsWith("/auth?") || trimmed.startsWith("/auth#")) {
    return fallback;
  }
  return trimmed;
}

/** Junta query do destino com a da URL actual (destino ganha em chaves duplicadas). */
export function mergeRedirectSearch(to: string, fromSearch: string, fromHash = ""): string {
  const hashIdx = to.indexOf("#");
  const pathAndQuery = hashIdx >= 0 ? to.slice(0, hashIdx) : to;
  const toHash = hashIdx >= 0 ? to.slice(hashIdx) : "";
  const qIdx = pathAndQuery.indexOf("?");
  const pathname = qIdx >= 0 ? pathAndQuery.slice(0, qIdx) : pathAndQuery;
  const toParams = new URLSearchParams(qIdx >= 0 ? pathAndQuery.slice(qIdx + 1) : "");
  const fromParams = new URLSearchParams(fromSearch.startsWith("?") ? fromSearch.slice(1) : fromSearch);
  fromParams.forEach((v, k) => {
    if (!toParams.has(k)) toParams.set(k, v);
  });
  const qs = toParams.toString();
  const hash = toHash || fromHash;
  return `${pathname}${qs ? `?${qs}` : ""}${hash}`;
}

export type AuthLocationState = {
  from?: { pathname: string; search?: string; hash?: string };
};

export function postAuthPathFromLocationState(
  state: unknown,
  searchRedirect: string | null,
  fallback = "/inicio",
): string {
  const from = (state as AuthLocationState | null)?.from;
  const fromPath = from
    ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
    : null;
  return resolvePostAuthRedirect(fromPath || searchRedirect, fallback);
}

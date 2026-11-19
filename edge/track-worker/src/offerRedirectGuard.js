/**
 * Espelha origin `isRedirectToAllowedOffer` + resolução de `?to=` no hop edge.
 * Mantido em módulo separado para testes node --test (Workers não exportam helpers).
 */

function normalizeHostname(host) {
  return String(host || "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

function normalizePathname(path) {
  const p = path || "/";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function effectivePort(u) {
  if (u.port) return u.port;
  if (u.protocol === "https:") return "443";
  if (u.protocol === "http:") return "80";
  return "";
}

/**
 * `?to=` só se host/path/porta baterem com o hoplink cacheado
 * (query da oferta pode trazer sub1/gate extras).
 */
export function isRedirectToAllowedOffer(requestedTo, allowedOffer) {
  const allowed = String(allowedOffer || "").trim();
  if (!allowed || allowed === "#" || !/^https?:\/\//i.test(allowed)) return false;
  let req;
  let al;
  try {
    req = new URL(requestedTo.trim());
    al = new URL(allowed);
  } catch {
    return false;
  }
  if (req.protocol !== "http:" && req.protocol !== "https:") return false;
  if (req.protocol !== al.protocol) return false;
  if (req.username || req.password || al.username || al.password) return false;
  if (normalizeHostname(req.hostname) !== normalizeHostname(al.hostname)) return false;
  if (effectivePort(req) !== effectivePort(al)) return false;
  if (normalizePathname(req.pathname) !== normalizePathname(al.pathname)) return false;
  for (const [key, val] of al.searchParams.entries()) {
    if (req.searchParams.get(key) !== val) return false;
  }
  return true;
}

/**
 * CTA bakeia `?to=` com subs/gate; sem isto o edge abre só `dest.destination`
 * e o media buyer perde atribuição na rede (BuyGoods/SmartAdv/…).
 */
export function resolveOfferDestination(cachedDestination, searchParams) {
  const configured = String(cachedDestination || "").trim();
  if (!configured || !/^https?:\/\//i.test(configured)) return null;
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");
  const toRaw = String(params.get("to") || "").trim();
  if (toRaw && /^https?:\/\//i.test(toRaw) && isRedirectToAllowedOffer(toRaw, configured)) {
    return toRaw;
  }
  return configured;
}

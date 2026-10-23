/** Extrai hoplink guardado na presell (conteúdo JSON). */
export function affiliateLinkFromPresellContent(content: unknown): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";
  const c = content as Record<string, unknown>;
  const raw = c.affiliate_link ?? c.affiliateLink;
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Mesma resolução que a pública (`content.affiliateLink` → `tracking.offerUrl`).
 * Evita 400 «Destino inválido» quando o wizard antigo só gravou offerUrl no tracking.
 */
function usableHttpOffer(raw: string): string {
  const s = raw.trim();
  if (!s || s === "#" || !/^https?:\/\//i.test(s)) return "";
  return s;
}

export function affiliateLinkFromPresellPage(content: unknown, tracking: unknown): string {
  const fromContent = usableHttpOffer(affiliateLinkFromPresellContent(content));
  if (fromContent) return fromContent;
  if (!tracking || typeof tracking !== "object" || Array.isArray(tracking)) return "";
  const t = tracking as Record<string, unknown>;
  const raw = t.offerUrl ?? t.offer_url;
  return typeof raw === "string" ? usableHttpOffer(raw) : "";
}

function normalizeHostname(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

function normalizePathname(path: string): string {
  const p = path || "/";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

/**
 * O parâmetro `to` do redirect só pode apontar para o hoplink configurado na presell
 * (mesmo host + path; query da oferta pode incluir parâmetros extra, ex. subs/UTM).
 */
export function isRedirectToAllowedOffer(requestedTo: string, allowedOffer: string): boolean {
  const allowed = allowedOffer.trim();
  if (!allowed || allowed === "#" || !/^https?:\/\//i.test(allowed)) return false;

  let req: URL;
  let al: URL;
  try {
    req = new URL(requestedTo.trim());
    al = new URL(allowed);
  } catch {
    return false;
  }

  if (req.protocol !== "http:" && req.protocol !== "https:") return false;
  if (req.protocol !== al.protocol) return false;
  if (normalizeHostname(req.hostname) !== normalizeHostname(al.hostname)) return false;
  if (normalizePathname(req.pathname) !== normalizePathname(al.pathname)) return false;

  for (const [key, val] of al.searchParams.entries()) {
    if (req.searchParams.get(key) !== val) return false;
  }
  return true;
}

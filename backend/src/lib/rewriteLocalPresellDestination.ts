/**
 * Braços de rotador criados no wizard local por vezes gravam
 * `http://localhost:8080/l|p/<uuid>`. Em produção isso parte o anúncio.
 * Reescreve para a origem pública do pedido (domínio custom / FRONTEND_URL).
 */

export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".local");
}

export function isLocalPresellDestination(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return isLocalHostname(u.hostname) && /^\/(p|l)\//i.test(u.pathname);
  } catch {
    return false;
  }
}

function envPublicOrigin(): string | null {
  const env =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim().split(",")[0]?.trim() ||
    process.env.APP_PUBLIC_URL?.trim();
  if (!env) return null;
  try {
    const u = new URL(env.includes("://") ? env : `https://${env}`);
    if (isLocalHostname(u.hostname)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function rewriteLocalPresellDestination(
  destinationUrl: string,
  preferredOrigin: string | null | undefined,
): string {
  const raw = destinationUrl.trim();
  if (!raw) return raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!isLocalHostname(u.hostname)) return raw;
  if (!/^\/(p|l)\//i.test(u.pathname)) return raw;

  let origin = (preferredOrigin || "").trim().replace(/\/+$/, "");
  if (origin && !/^https?:\/\//i.test(origin)) origin = `https://${origin}`;
  if (!origin) {
    const env = envPublicOrigin();
    if (!env) return raw;
    origin = env;
  }
  try {
    const o = new URL(origin);
    if (isLocalHostname(o.hostname)) return raw;
    return `${o.origin}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return raw;
  }
}

/**
 * Hoplinks Knownwalk/Everflow — não são sales pages (espelho / extract).
 * Espelha a regra em backend/src/lib/presellAffiliateHop.ts.
 */
const HOP_HOSTS = ["knownwalk.com"] as const;

export function looksLikeAffiliateHopOnlyUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    return HOP_HOSTS.some((m) => host === m || host.endsWith(`.${m}`));
  } catch {
    return false;
  }
}

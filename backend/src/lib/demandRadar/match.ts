/** Normalização partilhada para casar produto / título / campanha sem inventar scores. */

export function normalizeDemandNeedle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function demandTokens(raw: string): string[] {
  const n = normalizeDemandNeedle(raw);
  if (!n) return [];
  return n.split(" ").filter((t) => t.length >= 2);
}

/** Casa se needle ⊆ haystack ou partilha token significativo (≥3 chars). */
export function demandTextMatches(haystack: string, needle: string): boolean {
  const h = normalizeDemandNeedle(haystack);
  const n = normalizeDemandNeedle(needle);
  if (!h || !n) return false;
  if (h.includes(n) || n.includes(h)) return true;
  const hTokens = new Set(demandTokens(h));
  const nTokens = demandTokens(n).filter((t) => t.length >= 3);
  if (!nTokens.length) return false;
  return nTokens.some((t) => hTokens.has(t) || [...hTokens].some((ht) => ht.includes(t) || t.includes(ht)));
}

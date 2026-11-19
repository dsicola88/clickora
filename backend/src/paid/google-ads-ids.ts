/**
 * IDs Google Ads em resource names (`…/adGroupCriteria/{adGroupId}~{criterionId}`)
 * vs. só o criterion_id numérico (GAQL / import).
 * Nunca concatenar dígitos de `ag~crit` — a API devolve «Invalid number».
 */

const INT64_DIGITS = /^[1-9]\d{0,18}$/;

/** Último segmento de um resource name. */
export function googleAdsResourceLastSegment(resourceName: string): string {
  const parts = String(resourceName ?? "")
    .trim()
    .split("/")
    .filter(Boolean);
  return parts[parts.length - 1] ?? String(resourceName ?? "").trim();
}

/**
 * criterion_id (int64 decimal) a partir de ID puro, `adGroupId~criterionId` ou resource name.
 * Devolve null se inválido — não inventar.
 */
export function normalizeGoogleCriterionId(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const seg = googleAdsResourceLastSegment(s);
  const afterTilde = seg.includes("~") ? (seg.split("~").pop() ?? "") : seg;
  const id = afterTilde.replace(/\D/g, "");
  if (!INT64_DIGITS.test(id)) return null;
  return id;
}

/** ad_group.id / campaign.id / etc. — só dígitos, int64. */
export function normalizeGoogleNumericId(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const seg = googleAdsResourceLastSegment(String(raw).trim());
  /** Se vier `ag~crit` por engano, usar a parte do ad group (antes do ~). */
  const beforeTilde = seg.includes("~") ? (seg.split("~")[0] ?? "") : seg;
  const id = beforeTilde.replace(/\D/g, "");
  if (!INT64_DIGITS.test(id)) return null;
  return id;
}

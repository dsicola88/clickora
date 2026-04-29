/**
 * Idioma principal sugerido para copy de anúncio com base em geo (ISO-3166 alfa-2).
 * Heurística — notas de público podem sobrepor (prompt LLM).
 */
export function adCopyLocaleHintFromGeoIso2(geo: string[]): string {
  const codes = geo
    .map((g) =>
      String(g)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2),
    )
    .filter((c) => c.length === 2);
  const set = new Set(codes);
  const lusophone = ["PT", "BR", "AO", "MZ", "GW", "TL", "CV", "ST"];
  const hispanic = [
    "ES",
    "MX",
    "AR",
    "CO",
    "CL",
    "PE",
    "UY",
    "BO",
    "CR",
    "EC",
    "GT",
    "HN",
    "NI",
    "PA",
    "PY",
    "SV",
    "DO",
  ];
  if (lusophone.some((c) => set.has(c))) return "Portuguese";
  if (hispanic.some((c) => set.has(c))) return "Spanish";
  if (["FR", "BE", "CH", "LU", "MC"].some((c) => set.has(c))) return "French";
  if (["DE", "AT"].some((c) => set.has(c))) return "German";
  if (["US", "GB", "AU", "CA", "NZ", "IE"].some((c) => set.has(c))) return "English";
  return "English";
}

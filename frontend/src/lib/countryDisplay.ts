/**
 * Códigos ISO 3166-1 alpha-2 (ex.: PT, BR) para nome localizado e bandeira (emoji regional indicator).
 */

const REGION_NAMES_PT = new Intl.DisplayNames(["pt-PT"], { type: "region" });

/** Valida e devolve ISO alpha-2 em maiúsculas, ou null. */
export function normalizeIsoCountryCode(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase();
  if (t.length !== 2 || !/^[A-Z]{2}$/.test(t)) return null;
  return t;
}

/**
 * Bandeira regional (emoji) a partir de ISO alpha-2.
 * Devolve 🌐 se não houver código válido.
 */
export function countryFlagEmoji(code: string | null | undefined): string {
  const n = normalizeIsoCountryCode(code);
  if (!n) return "🌐";
  const base = 0x1f1e6;
  const a = n.charCodeAt(0) - 0x41;
  const b = n.charCodeAt(1) - 0x41;
  if (a < 0 || a > 25 || b < 0 || b > 25) return "🌐";
  return String.fromCodePoint(base + a, base + b);
}

/**
 * Nome do país em português (ex.: «Portugal»), ou «Desconhecido».
 * Se o código existir mas o Intl falhar, mostra o código em maiúsculas.
 */
export function countryDisplayLabel(code: string | null | undefined): string {
  const n = normalizeIsoCountryCode(code);
  if (!n) return "Desconhecido";
  try {
    const name = REGION_NAMES_PT.of(n);
    if (name && name.length > 0) return name;
    return n;
  } catch {
    return n;
  }
}

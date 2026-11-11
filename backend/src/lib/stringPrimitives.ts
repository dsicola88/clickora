import { normalizeIpForMatch } from "./normalizeIp";

/** Primeiro valor string não-vazio. */
export function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Só dígitos; vazio → null. */
export function onlyDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/** IPv4 só — alinhado com `normalizeIpForMatch` na verificação de tracking. */
export function parseIpv4Blacklist(raw: string): string | null {
  const t = normalizeIpForMatch(raw.trim());
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(t)) return null;
  const parts = t.split(".").map(Number);
  if (parts.some((n) => n > 255 || n < 0)) return null;
  return t;
}

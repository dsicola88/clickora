import { decryptSecretField, encryptSecretField } from "../lib/fieldEncryption";

/**
 * Tokens OAuth das ligações paid (Google / Meta / TikTok).
 * - Estados OAuth temporários (`state:…`) ficam em claro (precisam de `startsWith` na BD).
 * - Segredos reais usam AES-256-GCM via ENCRYPTION_KEY (mesmo mecanismo que integrações).
 */

export function isOAuthPendingToken(ref: string | null | undefined): boolean {
  return Boolean(ref?.trim().startsWith("state:"));
}

/** Persistir na BD — encripta segredos; deixa `state:` intacto. */
export function storePaidToken(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const t = plain.trim();
  if (t.startsWith("state:")) return t;
  return encryptSecretField(t);
}

/** Ler da BD para chamadas às APIs — desencripta se necessário. */
export function loadPaidToken(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  const t = stored.trim();
  if (t.startsWith("state:")) return t;
  return decryptSecretField(t);
}

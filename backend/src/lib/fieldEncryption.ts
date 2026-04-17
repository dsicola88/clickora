import crypto from "node:crypto";

/** Prefixo v1 — valores na BD sem este prefixo tratam-se como legado em texto claro. */
const PREFIX = "d1:";

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {
    /* ignore */
  }
  const u = Buffer.from(raw, "utf8");
  if (u.length === 32) return u;
  console.warn(
    "[fieldEncryption] ENCRYPTION_KEY inválida (use 32 bytes: hex 64 chars, base64, ou UTF-8 com 32 caracteres).",
  );
  return null;
}

let warnedPlaintextProduction = false;

/**
 * Encripta segredos de utilizador antes de persistir na BD (AES-256-GCM).
 * Sem `ENCRYPTION_KEY`, mantém texto claro (compatível com ambientes locais).
 */
export function encryptSecretField(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production" && !warnedPlaintextProduction) {
      warnedPlaintextProduction = true;
      console.warn(
        "[fieldEncryption] ENCRYPTION_KEY não definida — tokens guardados em texto claro. Defina ENCRYPTION_KEY em produção.",
      );
    }
    return plain;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, enc, tag]);
  return PREFIX + payload.toString("base64url");
}

/**
 * Desencripta valor lido da BD; legado sem prefixo devolve o texto tal como está.
 */
export function decryptSecretField(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  const s = stored.trim();
  if (!s.startsWith(PREFIX)) {
    return s;
  }
  const key = getKey();
  if (!key) {
    console.warn("[fieldEncryption] Dados encriptados na BD mas ENCRYPTION_KEY em falta.");
    return null;
  }
  try {
    const buf = Buffer.from(s.slice(PREFIX.length), "base64url");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(12, buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return dec.toString("utf8");
  } catch (e) {
    console.warn("[fieldEncryption] Falha ao desencriptar:", e instanceof Error ? e.message : e);
    return null;
  }
}

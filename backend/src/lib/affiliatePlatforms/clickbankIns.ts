import { createDecipheriv, createHash } from "node:crypto";

/** Chave ClickBank: os primeiros 32 hex de SHA-1(segredo), usados como bytes ASCII. */
export function clickbankInsKey(secret: string): Buffer {
  const hex = createHash("sha1").update(secret, "utf8").digest("hex").slice(0, 32);
  return Buffer.from(hex, "utf8");
}

function stripPadding(text: string): string {
  return text.replace(/[\u0000-\u0020]+$/g, "").trim();
}

/**
 * Decifra o envelope INS (notification + iv) com AES-256-CBC e padding zero,
 * como no exemplo oficial da ClickBank com OpenSSL.
 */
export function decryptClickbankNotification(
  notification: string,
  iv: string,
  secret: string,
): string | null {
  try {
    const key = clickbankInsKey(secret);
    const ivBuf = Buffer.from(iv, "base64");
    const data = Buffer.from(notification, "base64");
    if (key.length !== 32 || ivBuf.length !== 16 || data.length === 0 || data.length % 16 !== 0) return null;
    const decipher = createDecipheriv("aes-256-cbc", key, ivBuf);
    decipher.setAutoPadding(false);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    const text = stripPadding(plain.toString("utf8"));
    return text || null;
  } catch {
    return null;
  }
}

const CLICKBANK_FIELDS = [
  "transactionType",
  "transaction_type",
  "receipt",
  "totalAccountAmount",
  "affiliateCommission",
  "tid",
  "trackingId",
  "tracking_id",
  "trackingCodes",
  "currency",
] as const;

/** Só os campos de venda. Não copia e-mail, nome nem morada do comprador. */
export function clickbankSaleFields(plaintext: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const src = parsed as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of CLICKBANK_FIELDS) {
    const value = src[key];
    if (typeof value === "string" || typeof value === "number") out[key] = String(value);
  }
  return out.transactionType || out.transaction_type ? out : null;
}

import crypto from "crypto";
import { systemPrisma } from "./prisma";

/**
 * Idempotência de webhooks Hotmart (retentativas / duplicados).
 * Tabela criada via schemaRepair se a migração ainda não existir.
 */
export function hotmartEventReceiptKey(input: {
  event: string;
  email: string;
  productCode: string | null;
  offerCode: string | null;
  transactionHint: string | null;
}): string {
  const base = [
    input.event.trim().toLowerCase(),
    input.email.trim().toLowerCase(),
    input.productCode?.trim() || "",
    input.offerCode?.trim() || "",
    input.transactionHint?.trim() || "",
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

/** @returns true se este evento é novo e ficou registado; false se já foi processado. */
export async function claimHotmartEvent(eventKey: string): Promise<boolean> {
  try {
    const rows = await systemPrisma.$queryRawUnsafe<Array<{ event_key: string }>>(
      `INSERT INTO "hotmart_webhook_receipts" ("event_key", "created_at")
       VALUES ($1, NOW())
       ON CONFLICT ("event_key") DO NOTHING
       RETURNING "event_key"`,
      eventKey,
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    console.warn("[hotmart-idempotency] claim failed (fail-open once):", e);
    return true;
  }
}

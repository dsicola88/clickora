import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Extrai campos comuns do payload JSON do webhook Hotmart (várias versões de esquema).
 * @see https://developers.hotmart.com/docs/en/
 */
export function parseHotmartWebhookBody(body: unknown): {
  externalId: string | null;
  eventType: string;
  buyerEmail: string | null;
  productName: string | null;
  productId: string | null;
  priceCents: number | null;
  currency: string;
  status: string | null;
} | null {
  if (body === null || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const event = typeof root.event === "string" ? root.event : "";
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;

  const purchase = data.purchase && typeof data.purchase === "object" ? (data.purchase as Record<string, unknown>) : null;
  const product = data.product && typeof data.product === "object" ? (data.product as Record<string, unknown>) : null;
  const buyer = data.buyer && typeof data.buyer === "object" ? (data.buyer as Record<string, unknown>) : null;

  const transaction =
    (purchase?.transaction as string | undefined) ??
    (purchase?.order_id as string | undefined) ??
    (data.transaction as string | undefined) ??
    null;

  const buyerEmail =
    (buyer?.email as string | undefined)?.trim().toLowerCase() ||
    (data.buyer_email as string | undefined)?.trim().toLowerCase() ||
    null;

  let priceCents: number | null = null;
  const priceVal =
    purchase?.price ??
    purchase?.original_offer_price ??
    data.recurrence_value ??
    purchase?.full_price;
  if (priceVal && typeof priceVal === "object") {
    const v = (priceVal as Record<string, unknown>).value;
    if (typeof v === "number") priceCents = Math.round(v * 100);
  } else if (typeof priceVal === "number") {
    priceCents = Math.round(priceVal * 100);
  }

  const currencyRaw =
    (typeof (priceVal as Record<string, unknown>)?.currency_value === "string"
      ? (priceVal as Record<string, unknown>).currency_value
      : null) ||
    (typeof purchase?.currency === "string" ? purchase.currency : null) ||
    "BRL";

  const productName =
    (product?.name as string | undefined) || (data.product_name as string | undefined) || null;
  const productId =
    product?.id != null ? String(product.id) : data.product_id != null ? String(data.product_id) : null;

  const status =
    (purchase?.status as string | undefined) || (data.subscription_status as string | undefined) || null;

  return {
    externalId: transaction,
    eventType: event || (status ? `status:${status}` : "hotmart_event"),
    buyerEmail,
    productName,
    productId,
    priceCents,
    currency: typeof currencyRaw === "string" ? currencyRaw : "BRL",
    status,
  };
}

export async function upsertCommercePaymentFromHotmart(
  fields: NonNullable<ReturnType<typeof parseHotmartWebhookBody>>,
  rawPayload: Prisma.InputJsonValue | undefined,
): Promise<void> {
  const appUser = fields.buyerEmail
    ? await prisma.user.findUnique({
        where: { email: fields.buyerEmail },
        select: { id: true },
      })
    : null;

  const data = {
    source: "hotmart" as const,
    eventType: fields.eventType,
    buyerEmail: fields.buyerEmail,
    productName: fields.productName,
    productId: fields.productId,
    priceCents: fields.priceCents,
    currency: fields.currency,
    status: fields.status,
    appUserId: appUser?.id ?? null,
    rawPayload: rawPayload ?? undefined,
  };

  if (fields.externalId) {
    await prisma.commercePayment.upsert({
      where: { externalId: fields.externalId },
      create: { ...data, externalId: fields.externalId },
      update: data,
    });
  } else {
    await prisma.commercePayment.create({
      data: { ...data, externalId: null },
    });
  }
}

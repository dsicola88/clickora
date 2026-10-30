import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { pickOrderIdFromPayload } from "../../lib/affiliatePostbackParsers";
import { decryptSecretField } from "../../lib/fieldEncryption";
import { eventSourceUrlFromClick, stringFieldsFromJson } from "../../lib/clickEventContext";
import { notifyUserConversionSyncFailure } from "../../lib/syncFailureAlerts";

const GRAPH_VERSION = "v22.0";

/** Em produção o destino é sempre o Graph. O mock local só entra com E2E_AD_MOCK=1 fora de production. */
function metaGraphOrigin(): string {
  const override = process.env.META_CAPI_GRAPH_ORIGIN?.trim();
  if (
    override &&
    process.env.E2E_AD_MOCK === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    return override.replace(/\/$/, "");
  }
  return "https://graph.facebook.com";
}

/**
 * Pronto a enviar se Pixel + token existem.
 * Sem interruptor extra: credenciais = envio activo (pausar = apagar o token).
 */
export function isMetaCapiReadyForUser(user: {
  metaCapiEnabled?: boolean;
  metaPixelId: string | null | undefined;
  metaAccessToken: string | null | undefined;
}): boolean {
  if (!user.metaPixelId?.trim()) return false;
  const raw = user.metaAccessToken?.trim();
  if (!raw) return false;
  return Boolean(decryptSecretField(raw)?.trim());
}

export async function sendMetaPurchaseEvent(params: {
  pixelId: string;
  accessToken: string;
  eventId: string;
  eventName?: "Purchase" | "Refund";
  eventTimeSec: number;
  value: number;
  currency: string;
  orderId: string;
  fbclid?: string | null;
  fbp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  clickCreatedAtSec: number;
  eventSourceUrl?: string | null;
  testEventCode?: string | null;
}): Promise<{ ok: true; raw: unknown } | { ok: false; error: string; raw?: unknown }> {
  const pixel = params.pixelId.trim();
  const token = params.accessToken.trim();
  const url = `${metaGraphOrigin()}/${GRAPH_VERSION}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`;

  const user_data: Record<string, string> = {};
  if (params.clientIp?.trim()) user_data.client_ip_address = params.clientIp.trim();
  if (params.userAgent?.trim()) user_data.client_user_agent = params.userAgent.trim().slice(0, 512);
  if (params.fbp?.trim()) user_data.fbp = params.fbp.trim();
  if (params.fbclid?.trim()) {
    const ts = params.clickCreatedAtSec || Math.floor(Date.now() / 1000);
    user_data.fbc = `fb.1.${ts}.${params.fbclid.trim()}`;
  }

  const custom_data: Record<string, unknown> = {
    currency: params.currency.toUpperCase().slice(0, 3),
    value: params.value,
    order_id: params.orderId.slice(0, 200),
  };

  const eventRow: Record<string, unknown> = {
    event_name: params.eventName || "Purchase",
    event_time: params.eventTimeSec,
    event_id: params.eventId,
    action_source: "website",
    user_data,
    custom_data,
  };
  if (params.eventSourceUrl?.trim()) {
    eventRow.event_source_url = params.eventSourceUrl.trim().slice(0, 2000);
  }

  const payload: Record<string, unknown> = {
    data: [eventRow],
  };
  if (params.testEventCode?.trim()) {
    payload.test_event_code = params.testEventCode.trim();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, error: JSON.stringify(json).slice(0, 2000), raw: json };
  }
  if (json.error) {
    const e = json.error;
    if (typeof e === "object" && e && "message" in e && typeof (e as { message: string }).message === "string") {
      return { ok: false, error: (e as { message: string }).message, raw: json };
    }
    return { ok: false, error: JSON.stringify(e).slice(0, 2000), raw: json };
  }
  return { ok: true, raw: json };
}

async function noteMetaRefundBlocked(
  conversionId: string,
  prev: Record<string, unknown>,
  reason: string,
  field: "refund" | "partial_refund" = "refund",
): Promise<void> {
  await systemPrisma.conversion.update({
    where: { id: conversionId },
    data: {
      metaCapiSyncDetail: {
        ...prev,
        [field]: "skipped",
        [`${field}_error`]: reason,
      } as Prisma.InputJsonValue,
    },
  });
}

async function markMetaCapiSkip(
  conversionId: string,
  code: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await systemPrisma.conversion.update({
    where: { id: conversionId },
    data: {
      metaCapiSync: code,
      metaCapiSyncedAt: new Date(),
      metaCapiSyncDetail: detail as Prisma.InputJsonValue,
    },
  });
}

/**
 * Após conversão aprovada (postback): envia Purchase para Meta CAPI se configurado.
 * Idempotente se `metaCapiSync === sent`.
 */
export async function retractConversionFromMetaCapi(conversionId: string): Promise<void> {
  return syncConversionToMetaCapi(conversionId, "refund");
}

/** Reembolso parcial: envia Refund só do valor devolvido e mantém o Purchase em sent. */
export async function reportPartialRefundToMetaCapi(
  conversionId: string,
  refundAmount: number,
  refundTxnId: string | null,
): Promise<void> {
  return syncConversionToMetaCapi(conversionId, "partial", { refundAmount, refundTxnId });
}

export async function syncConversionToMetaCapi(
  conversionId: string,
  mode: "purchase" | "refund" | "partial" = "purchase",
  partial?: { refundAmount: number; refundTxnId: string | null },
): Promise<void> {
  const conv = await systemPrisma.conversion.findUnique({
    where: { id: conversionId },
    include: {
      click: true,
      user: true,
    },
  });

  if (!conv) return;
  const prevDetail = (conv.metaCapiSyncDetail || {}) as Record<string, unknown>;
  const partialIds = Array.isArray(prevDetail.partial_refund_ids)
    ? prevDetail.partial_refund_ids.filter((id): id is string => typeof id === "string")
    : [];
  const partialKey = partial?.refundTxnId || (partial ? `amt:${partial.refundAmount}` : "");
  if (mode === "partial") {
    if (conv.status !== "approved" || conv.metaCapiSync !== "sent") return;
    if (!partial || !(partial.refundAmount > 0) || partialIds.includes(partialKey)) return;
  } else if (mode === "refund") {
    if (conv.status !== "refunded") return;
    if (prevDetail.refund === "sent") return;
    if (conv.metaCapiSync !== "sent") return;
  } else if (conv.status !== "approved" || conv.metaCapiSync === "sent") {
    return;
  }
  const adMode = mode === "purchase" ? "purchase" : "refund";
  if (!conv.click) {
    if (adMode === "refund") return;
    await markMetaCapiSkip(conv.id, "skipped_no_fbclid", {
      reason: "Conversão sem clique associado (não atribuída) — sem fbclid para CAPI.",
    });
    return;
  }

  const user = conv.user;
  if (!isMetaCapiReadyForUser(user)) {
    if (adMode === "refund") return;
    await markMetaCapiSkip(conv.id, "skipped_disabled", {
      reason: "A integração Meta (CAPI) está inactiva ou faltam Pixel ID e token de acesso.",
    });
    return;
  }

  const pixelId = user.metaPixelId!.trim();
  const accessToken = decryptSecretField(user.metaAccessToken)?.trim();
  if (!accessToken) {
    if (adMode === "refund") {
      await noteMetaRefundBlocked(
        conv.id,
        prevDetail,
        "token_ilegivel",
        mode === "partial" ? "partial_refund" : "refund",
      );
      return;
    }
    await markMetaCapiSkip(conv.id, "skipped_no_config", {
      reason: "Não foi possível ler o token da Meta (confirme que está guardado e que ENCRYPTION_KEY não mudou).",
    });
    return;
  }

  const clickMeta = (conv.click.metadata || {}) as Record<string, unknown>;
  const fbclid = typeof clickMeta.fbclid === "string" ? clickMeta.fbclid : null;
  const fbp = typeof clickMeta.fbp === "string" ? clickMeta.fbp : null;

  if (!fbclid?.trim()) {
    if (adMode === "refund") {
      await noteMetaRefundBlocked(
        conv.id,
        prevDetail,
        "sem_fbclid",
        mode === "partial" ? "partial_refund" : "refund",
      );
      return;
    }
    await markMetaCapiSkip(conv.id, "skipped_no_fbclid", {
      reason:
        "O clique não contém «fbclid» no rastreio. Os anúncios da Meta requerem o parâmetro no URL da landing para atribuição e envio CAPI.",
    });
    return;
  }

  const clickTs = Math.floor(conv.click.createdAt.getTime() / 1000);
  const amount = mode === "partial" && partial
    ? partial.refundAmount
    : conv.amount != null
      ? Number(conv.amount)
      : 0;
  const currency = (conv.currency || "USD").toUpperCase().slice(0, 3);
  const eventTimeSec = Math.floor(conv.createdAt.getTime() / 1000);
  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = conv.externalOrderId?.trim() || pickOrderIdFromPayload(flat) || conv.id;
  const eventSourceUrl = eventSourceUrlFromClick({
    referrer: conv.click.referrer,
    metadata: conv.click.metadata,
  });

  const result = await sendMetaPurchaseEvent({
    pixelId,
    accessToken,
    eventId: mode === "partial" ? `${conv.id}:partial:${partialKey}` : mode === "refund" ? `${conv.id}:refund` : conv.id,
    eventName: adMode === "refund" ? "Refund" : "Purchase",
    eventTimeSec,
    value: Number.isFinite(amount) ? amount : 0,
    currency,
    orderId,
    fbclid,
    fbp,
    clientIp: conv.click.ipAddress ?? undefined,
    userAgent: conv.click.userAgent ?? undefined,
    clickCreatedAtSec: clickTs,
    eventSourceUrl: eventSourceUrl ?? null,
    testEventCode: user.metaCapiTestEventCode,
  });

  if (result.ok) {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        metaCapiSync: mode === "purchase" ? "sent" : conv.metaCapiSync,
        metaCapiSyncedAt: new Date(),
        metaCapiSyncDetail: (mode === "partial"
          ? { ...prevDetail, partial_refund: "sent", partial_refund_ids: [...partialIds, partialKey] }
          : mode === "refund"
          ? { ...prevDetail, refund: "sent", refund_response: result.raw }
          : { ok: true, response: result.raw }) as Prisma.InputJsonValue,
      },
    });
  } else if (mode === "refund" || mode === "partial") {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        metaCapiSyncDetail: {
          ...prevDetail,
          ...(mode === "partial"
            ? { partial_refund: "failed", partial_refund_error: result.error }
            : { refund: "failed", refund_error: result.error }),
        } as Prisma.InputJsonValue,
      },
    });
  } else {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        metaCapiSync: "failed",
        metaCapiSyncedAt: new Date(),
        metaCapiSyncDetail: { ok: false, error: result.error, raw: result.raw } as Prisma.InputJsonValue,
      },
    });
    notifyUserConversionSyncFailure(conv.userId, {
      platform: "meta_capi",
      conversionId: conv.id,
      error: result.error,
    });
  }
}

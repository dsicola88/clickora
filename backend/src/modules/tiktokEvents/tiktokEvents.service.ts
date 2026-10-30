import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { pickOrderIdFromPayload } from "../../lib/affiliatePostbackParsers";
import { decryptSecretField } from "../../lib/fieldEncryption";
import { eventSourceUrlFromClick, stringFieldsFromJson, tiktokTtpFromClickMetadata } from "../../lib/clickEventContext";
import { notifyUserConversionSyncFailure } from "../../lib/syncFailureAlerts";

const TIKTOK_EVENT_TRACK_URL_LIVE = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

/** Em produção o destino é sempre a Events API. O mock local só entra com E2E_AD_MOCK=1 fora de production. */
function tiktokEventTrackUrl(): string {
  const override = process.env.TIKTOK_EVENTS_TRACK_URL?.trim();
  if (
    override &&
    process.env.E2E_AD_MOCK === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    return override;
  }
  return TIKTOK_EVENT_TRACK_URL_LIVE;
}

/** Pronto se pixel + token (sem interruptor extra). */
export function isTikTokEventsReadyForUser(user: {
  tiktokEventsEnabled?: boolean;
  tiktokPixelId: string | null | undefined;
  tiktokEventsAccessToken: string | null | undefined;
}): boolean {
  if (!user.tiktokPixelId?.trim()) return false;
  const raw = user.tiktokEventsAccessToken?.trim();
  if (!raw) return false;
  return Boolean(decryptSecretField(raw)?.trim());
}

function parseTikTokApiResult(json: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  const code = json.code;
  if (code === 0) return { ok: true };
  const msg = typeof json.message === "string" ? json.message : JSON.stringify(json).slice(0, 2000);
  const rid = json.request_id;
  const withRid = typeof rid === "string" && rid.trim() ? `${msg} (request_id: ${rid})` : msg;
  return { ok: false, error: withRid };
}

export async function sendTikTokPurchaseEvent(params: {
  pixelCode: string;
  accessToken: string;
  eventId: string;
  eventName?: "Purchase" | "Refund";
  eventTimeSec: number;
  value: number;
  currency: string;
  ttclid: string;
  orderId: string;
  pageUrl?: string | null;
  ttp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  testEventCode?: string | null;
}): Promise<{ ok: true; raw: unknown } | { ok: false; error: string; raw?: unknown }> {
  const pixel = params.pixelCode.trim();
  const token = params.accessToken.trim();

  const user: Record<string, string> = {
    ttclid: params.ttclid.trim(),
  };
  if (params.clientIp?.trim()) user.ip = params.clientIp.trim();
  if (params.userAgent?.trim()) user.user_agent = params.userAgent.trim().slice(0, 1024);
  if (params.ttp?.trim()) user.ttp = params.ttp.trim();

  const page =
    params.pageUrl?.trim() && /^https?:\/\//i.test(params.pageUrl.trim())
      ? { url: params.pageUrl.trim().slice(0, 2000) }
      : undefined;

  const dataRow: Record<string, unknown> = {
    event: params.eventName || "Purchase",
    event_id: params.eventId,
    event_time: params.eventTimeSec,
    user,
    properties: {
      value: params.value,
      currency: params.currency.toUpperCase().slice(0, 3),
      content_type: "product",
      order_id: params.orderId.slice(0, 200),
    },
  };
  if (page) dataRow.page = page;

  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixel,
    data: [dataRow],
  };
  if (params.testEventCode?.trim()) {
    body.test_event_code = params.testEventCode.trim();
  }

  let res: Response;
  try {
    res = await fetch(tiktokEventTrackUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": token,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, error: JSON.stringify(json).slice(0, 2000), raw: json };
  }
  const parsed = parseTikTokApiResult(json);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, raw: json };
  }
  return { ok: true, raw: json };
}

async function noteTikTokRefundBlocked(
  conversionId: string,
  prev: Record<string, unknown>,
  reason: string,
  field: "refund" | "partial_refund" = "refund",
): Promise<void> {
  await systemPrisma.conversion.update({
    where: { id: conversionId },
    data: {
      tiktokEventsSyncDetail: {
        ...prev,
        [field]: "skipped",
        [`${field}_error`]: reason,
      } as Prisma.InputJsonValue,
    },
  });
}

async function markTikTokSkip(
  conversionId: string,
  code: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await systemPrisma.conversion.update({
    where: { id: conversionId },
    data: {
      tiktokEventsSync: code,
      tiktokEventsSyncedAt: new Date(),
      tiktokEventsSyncDetail: detail as Prisma.InputJsonValue,
    },
  });
}

/**
 * Após conversão aprovada (postback): envia Purchase para TikTok Events API se configurado.
 * Idempotente se `tiktokEventsSync === sent`.
 */
export async function retractConversionFromTikTokEvents(conversionId: string): Promise<void> {
  return syncConversionToTikTokEvents(conversionId, "refund");
}

/** Reembolso parcial: envia Refund só do valor devolvido e mantém o Purchase em sent. */
export async function reportPartialRefundToTikTokEvents(
  conversionId: string,
  refundAmount: number,
  refundTxnId: string | null,
): Promise<void> {
  return syncConversionToTikTokEvents(conversionId, "partial", { refundAmount, refundTxnId });
}

export async function syncConversionToTikTokEvents(
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
  const prevDetail = (conv.tiktokEventsSyncDetail || {}) as Record<string, unknown>;
  const partialIds = Array.isArray(prevDetail.partial_refund_ids)
    ? prevDetail.partial_refund_ids.filter((id): id is string => typeof id === "string")
    : [];
  const partialKey = partial?.refundTxnId || (partial ? `amt:${partial.refundAmount}` : "");
  if (mode === "partial") {
    if (conv.status !== "approved" || conv.tiktokEventsSync !== "sent") return;
    if (!partial || !(partial.refundAmount > 0) || partialIds.includes(partialKey)) return;
  } else if (mode === "refund") {
    if (conv.status !== "refunded") return;
    if (prevDetail.refund === "sent") return;
    if (conv.tiktokEventsSync !== "sent") return;
  } else if (conv.status !== "approved" || conv.tiktokEventsSync === "sent") {
    return;
  }
  const adMode = mode === "purchase" ? "purchase" : "refund";
  if (!conv.click) {
    if (adMode === "refund") return;
    await markTikTokSkip(conv.id, "skipped_no_ttclid", {
      reason: "Conversão sem clique associado (não atribuída) — sem ttclid para Events API.",
    });
    return;
  }

  const user = conv.user;
  if (!isTikTokEventsReadyForUser(user)) {
    if (adMode === "refund") return;
    await markTikTokSkip(conv.id, "skipped_disabled", {
      reason: "Faltam Pixel ID e/ou token TikTok Events em Integrações → Pixels.",
    });
    return;
  }

  const pixelId = user.tiktokPixelId!.trim();
  const accessToken = decryptSecretField(user.tiktokEventsAccessToken)?.trim();
  if (!accessToken) {
    if (adMode === "refund") {
      await noteTikTokRefundBlocked(
        conv.id,
        prevDetail,
        "token_ilegivel",
        mode === "partial" ? "partial_refund" : "refund",
      );
      return;
    }
    await markTikTokSkip(conv.id, "skipped_no_config", {
      reason: "Não foi possível ler o token do TikTok (confirme que está guardado e que ENCRYPTION_KEY não mudou).",
    });
    return;
  }

  const clickMeta = (conv.click.metadata || {}) as Record<string, unknown>;
  const ttclid = typeof clickMeta.ttclid === "string" ? clickMeta.ttclid : null;

  if (!ttclid?.trim()) {
    if (adMode === "refund") {
      await noteTikTokRefundBlocked(
        conv.id,
        prevDetail,
        "sem_ttclid",
        mode === "partial" ? "partial_refund" : "refund",
      );
      return;
    }
    await markTikTokSkip(conv.id, "skipped_no_ttclid", {
      reason:
        "O clique não contém «ttclid» no rastreio. Os anúncios TikTok requerem o parâmetro no URL da landing para atribuição e envio server-side.",
    });
    return;
  }

  const amount = mode === "partial" && partial
    ? partial.refundAmount
    : conv.amount != null
      ? Number(conv.amount)
      : 0;
  const currency = (conv.currency || "USD").toUpperCase().slice(0, 3);
  const eventTimeSec = Math.floor(conv.createdAt.getTime() / 1000);
  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = conv.externalOrderId?.trim() || pickOrderIdFromPayload(flat) || conv.id;
  const pageUrl = eventSourceUrlFromClick({
    referrer: conv.click.referrer,
    metadata: conv.click.metadata,
  });
  const ttp = tiktokTtpFromClickMetadata(conv.click.metadata);

  const result = await sendTikTokPurchaseEvent({
    pixelCode: pixelId,
    accessToken,
    eventId: mode === "partial" ? `${conv.id}:partial:${partialKey}` : mode === "refund" ? `${conv.id}:refund` : conv.id,
    eventName: adMode === "refund" ? "Refund" : "Purchase",
    eventTimeSec,
    value: Number.isFinite(amount) ? amount : 0,
    currency,
    ttclid: ttclid.trim(),
    orderId,
    pageUrl: pageUrl ?? null,
    ttp: ttp ?? null,
    clientIp: conv.click.ipAddress ?? undefined,
    userAgent: conv.click.userAgent ?? undefined,
    testEventCode: user.tiktokEventsTestEventCode,
  });

  if (result.ok) {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        tiktokEventsSync: mode === "purchase" ? "sent" : conv.tiktokEventsSync,
        tiktokEventsSyncedAt: new Date(),
        tiktokEventsSyncDetail: (mode === "partial"
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
        tiktokEventsSyncDetail: {
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
        tiktokEventsSync: "failed",
        tiktokEventsSyncedAt: new Date(),
        tiktokEventsSyncDetail: { ok: false, error: result.error, raw: result.raw } as Prisma.InputJsonValue,
      },
    });
    notifyUserConversionSyncFailure(conv.userId, {
      platform: "tiktok_events",
      conversionId: conv.id,
      error: result.error,
    });
  }
}

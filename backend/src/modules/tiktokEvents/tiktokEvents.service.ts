import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { pickOrderIdFromPayload } from "../../lib/affiliatePostbackParsers";
import { decryptSecretField } from "../../lib/fieldEncryption";
import { eventSourceUrlFromClick, stringFieldsFromJson, tiktokTtpFromClickMetadata } from "../../lib/clickEventContext";
import { notifyUserConversionSyncFailure } from "../../lib/syncFailureAlerts";

const TIKTOK_EVENT_TRACK_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export function isTikTokEventsReadyForUser(user: {
  tiktokEventsEnabled: boolean;
  tiktokPixelId: string | null | undefined;
  tiktokEventsAccessToken: string | null | undefined;
}): boolean {
  if (!user.tiktokEventsEnabled || !user.tiktokPixelId?.trim()) return false;
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
    event: "Purchase",
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
    res = await fetch(TIKTOK_EVENT_TRACK_URL, {
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
export async function syncConversionToTikTokEvents(conversionId: string): Promise<void> {
  const conv = await systemPrisma.conversion.findUnique({
    where: { id: conversionId },
    include: {
      click: true,
      user: true,
    },
  });

  if (!conv || conv.status !== "approved") return;
  if (conv.tiktokEventsSync === "sent") return;

  const user = conv.user;
  if (!isTikTokEventsReadyForUser(user)) {
    await markTikTokSkip(conv.id, "skipped_disabled", {
      reason: "A integração TikTok (Events API) está inactiva ou faltam Pixel e token de acesso.",
    });
    return;
  }

  const pixelId = user.tiktokPixelId!.trim();
  const accessToken = decryptSecretField(user.tiktokEventsAccessToken)?.trim();
  if (!accessToken) {
    await markTikTokSkip(conv.id, "skipped_no_config", {
      reason: "Não foi possível ler o token do TikTok (confirme que está guardado e que ENCRYPTION_KEY não mudou).",
    });
    return;
  }

  const clickMeta = (conv.click.metadata || {}) as Record<string, unknown>;
  const ttclid = typeof clickMeta.ttclid === "string" ? clickMeta.ttclid : null;

  if (!ttclid?.trim()) {
    await markTikTokSkip(conv.id, "skipped_no_ttclid", {
      reason:
        "O clique não contém «ttclid» no rastreio. Os anúncios TikTok requerem o parâmetro no URL da landing para atribuição e envio server-side.",
    });
    return;
  }

  const amount = conv.amount != null ? Number(conv.amount) : 0;
  const currency = (conv.currency || "USD").toUpperCase().slice(0, 3);
  const eventTimeSec = Math.floor(conv.createdAt.getTime() / 1000);
  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = pickOrderIdFromPayload(flat) || conv.id;
  const pageUrl = eventSourceUrlFromClick({
    referrer: conv.click.referrer,
    metadata: conv.click.metadata,
  });
  const ttp = tiktokTtpFromClickMetadata(conv.click.metadata);

  const result = await sendTikTokPurchaseEvent({
    pixelCode: pixelId,
    accessToken,
    eventId: conv.id,
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
        tiktokEventsSync: "sent",
        tiktokEventsSyncedAt: new Date(),
        tiktokEventsSyncDetail: { ok: true, response: result.raw } as Prisma.InputJsonValue,
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

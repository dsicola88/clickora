import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { pickOrderIdFromPayload } from "../../lib/affiliatePostbackParsers";
import { decryptSecretField } from "../../lib/fieldEncryption";
import { eventSourceUrlFromClick, stringFieldsFromJson } from "../../lib/clickEventContext";
import { notifyUserConversionSyncFailure } from "../../lib/syncFailureAlerts";

const GRAPH_VERSION = "v22.0";

export function isMetaCapiReadyForUser(user: {
  metaCapiEnabled: boolean;
  metaPixelId: string | null | undefined;
  metaAccessToken: string | null | undefined;
}): boolean {
  if (!user.metaCapiEnabled || !user.metaPixelId?.trim()) return false;
  const raw = user.metaAccessToken?.trim();
  if (!raw) return false;
  return Boolean(decryptSecretField(raw)?.trim());
}

export async function sendMetaPurchaseEvent(params: {
  pixelId: string;
  accessToken: string;
  eventId: string;
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
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`;

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
    event_name: "Purchase",
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
export async function syncConversionToMetaCapi(conversionId: string): Promise<void> {
  const conv = await systemPrisma.conversion.findUnique({
    where: { id: conversionId },
    include: {
      click: true,
      user: true,
    },
  });

  if (!conv || conv.status !== "approved") return;
  if (conv.metaCapiSync === "sent") return;

  const user = conv.user;
  if (!isMetaCapiReadyForUser(user)) {
    await markMetaCapiSkip(conv.id, "skipped_disabled", {
      reason: "A integração Meta (CAPI) está inactiva ou faltam Pixel ID e token de acesso.",
    });
    return;
  }

  const pixelId = user.metaPixelId!.trim();
  const accessToken = decryptSecretField(user.metaAccessToken)?.trim();
  if (!accessToken) {
    await markMetaCapiSkip(conv.id, "skipped_no_config", {
      reason: "Não foi possível ler o token da Meta (confirme que está guardado e que ENCRYPTION_KEY não mudou).",
    });
    return;
  }

  const clickMeta = (conv.click.metadata || {}) as Record<string, unknown>;
  const fbclid = typeof clickMeta.fbclid === "string" ? clickMeta.fbclid : null;
  const fbp = typeof clickMeta.fbp === "string" ? clickMeta.fbp : null;

  if (!fbclid?.trim()) {
    await markMetaCapiSkip(conv.id, "skipped_no_fbclid", {
      reason:
        "O clique não contém «fbclid» no rastreio. Os anúncios da Meta requerem o parâmetro no URL da landing para atribuição e envio CAPI.",
    });
    return;
  }

  const clickTs = Math.floor(conv.click.createdAt.getTime() / 1000);
  const amount = conv.amount != null ? Number(conv.amount) : 0;
  const currency = (conv.currency || "USD").toUpperCase().slice(0, 3);
  const eventTimeSec = Math.floor(conv.createdAt.getTime() / 1000);
  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = pickOrderIdFromPayload(flat) || conv.id;
  const eventSourceUrl = eventSourceUrlFromClick({
    referrer: conv.click.referrer,
    metadata: conv.click.metadata,
  });

  const result = await sendMetaPurchaseEvent({
    pixelId,
    accessToken,
    eventId: conv.id,
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
        metaCapiSync: "sent",
        metaCapiSyncedAt: new Date(),
        metaCapiSyncDetail: { ok: true, response: result.raw } as Prisma.InputJsonValue,
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

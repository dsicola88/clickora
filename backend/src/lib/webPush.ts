import webpush from "web-push";
import { systemPrisma } from "./prisma";

let configured = false;

export function initWebPushFromEnv(): void {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = (process.env.VAPID_SUBJECT || "mailto:support@dclickora.com").trim();
  if (!pub || !priv) {
    console.warn("[web-push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes — notificações push desativadas.");
    return;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export function isWebPushConfigured(): boolean {
  return configured;
}

export function getVapidPublicKeyFromEnv(): string | null {
  const k = process.env.VAPID_PUBLIC_KEY?.trim();
  return k || null;
}

export type WebPushPayload = {
  title: string;
  body: string;
  /** Caminho relativo (ex. /tracking/dashboard) ou URL absoluta */
  url?: string;
};

/**
 * Envia notificação a todas as subscrições do utilizador. Remove subscrições expiradas (410/404).
 */
export async function sendWebPushToUser(userId: string, payload: WebPushPayload): Promise<void> {
  if (!configured) return;

  const subs = await systemPrisma.webPushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/tracking/dashboard",
  });

  const toRemove: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const pushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(pushSub, body);
      } catch (err: unknown) {
        const status = typeof err === "object" && err !== null && "statusCode" in err ? (err as { statusCode?: number }).statusCode : undefined;
        if (status === 410 || status === 404) {
          toRemove.push(s.id);
        } else {
          console.warn("[web-push] send failed", userId, status, err);
        }
      }
    }),
  );

  if (toRemove.length > 0) {
    await systemPrisma.webPushSubscription.deleteMany({
      where: { id: { in: toRemove } },
    });
  }
}

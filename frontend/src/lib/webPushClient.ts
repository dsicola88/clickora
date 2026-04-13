import { integrationsService } from "@/services/integrationsService";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const SW_PATH = "/sw-push.js";

/** Indica se este browser já tem subscrição push activa (mesmo dispositivo). */
export async function hasLocalWebPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

/**
 * Regista o service worker, pede permissão e envia a subscrição ao servidor.
 * @returns true se ficou subscrito com sucesso
 */
export async function subscribeToWebPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Este browser não suporta Web Push." };
  }

  const { data: cfg, error: cfgErr } = await integrationsService.getWebPushConfig();
  if (cfgErr) return { ok: false, error: cfgErr };
  if (!cfg?.configured || !cfg.vapid_public_key) {
    return {
      ok: false,
      error: "O servidor ainda não tem chaves VAPID configuradas. Contacte o suporte ou consulte a documentação do deploy.",
    };
  }

  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, error: "Permissão de notificações recusada. Ative nas definições do browser." };
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.vapid_public_key),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Subscrição inválida do browser." };
  }

  const { error } = await integrationsService.subscribeWebPush({
    subscription: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
    user_agent: typeof navigator.userAgent === "string" ? navigator.userAgent.slice(0, 512) : undefined,
  });
  if (error) return { ok: false, error };

  return { ok: true };
}

/**
 * Remove subscrição local e registo no servidor.
 */
export async function unsubscribeFromWebPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const { error } = await integrationsService.unsubscribeWebPush(sub.endpoint);
      if (error) return { ok: false, error };
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao remover subscrição.";
    return { ok: false, error: msg };
  }
}

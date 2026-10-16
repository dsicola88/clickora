import { SALE_CHIME_FRESH_MS } from "@/lib/saleChime";

export const SALE_CHIME_PUSH_CACHE = "dclickora-push-chime-v1";
export const SALE_CHIME_PUSH_CACHE_KEY = "https://dclickora.internal/pending-chime";

export type PendingPushChime = {
  id: string;
  sound: string;
  at: number;
};

export async function readPendingPushChime(): Promise<PendingPushChime | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(SALE_CHIME_PUSH_CACHE);
    const res = await cache.match(SALE_CHIME_PUSH_CACHE_KEY);
    if (!res) return null;
    const json = (await res.json()) as PendingPushChime;
    if (!json || typeof json.at !== "number") return null;
    if (Date.now() - json.at > SALE_CHIME_FRESH_MS) {
      await cache.delete(SALE_CHIME_PUSH_CACHE_KEY);
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

export async function clearPendingPushChime(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(SALE_CHIME_PUSH_CACHE);
    await cache.delete(SALE_CHIME_PUSH_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

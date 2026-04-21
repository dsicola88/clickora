import { isPresellUuidParam } from "@/lib/publicPresellOrigin";

const KEY_PREFIX = "clickora-root-presell:";

export function rootPresellStorageKey(hostname: string): string {
  return `${KEY_PREFIX}${hostname.toLowerCase()}`;
}

export function readCachedRootPresellId(hostname: string): string | null {
  try {
    const raw = sessionStorage.getItem(rootPresellStorageKey(hostname));
    const id = raw?.trim() ?? "";
    return isPresellUuidParam(id) ? id : null;
  } catch {
    return null;
  }
}

export function writeCachedRootPresellId(hostname: string, id: string): void {
  try {
    const t = id.trim();
    if (!isPresellUuidParam(t)) return;
    sessionStorage.setItem(rootPresellStorageKey(hostname), t);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCachedRootPresellId(hostname: string): void {
  try {
    sessionStorage.removeItem(rootPresellStorageKey(hostname));
  } catch {
    /* ignore */
  }
}

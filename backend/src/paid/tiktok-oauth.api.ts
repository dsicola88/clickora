/**
 * Access token TikTok (Marketing API v1.3) — access ~24h, refresh ~1 ano.
 * https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/
 */
import { prisma } from "./paidPrisma";
import { paidLog } from "../lib/paidLog";

const REFRESH_PATH = "oauth2/refresh_token/";
const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";
/** Renovar de forma proactiva se a última gravação for mais antiga (ms). */
const PROACTIVE_REFRESH_AFTER_MS = 20 * 60 * 60 * 1000; // 20h

type RefreshJson = {
  code?: number;
  message?: string;
  data?: { access_token?: string; refresh_token?: string; expires_in?: number };
  request_id?: string;
};

export async function refreshTikTokAccessToken(
  connectionId: string,
  refreshToken: string,
): Promise<{ ok: true; accessToken: string; refreshToken: string } | { ok: false; error: string; requestId?: string }> {
  const appId = process.env.TIKTOK_APP_ID;
  const secret = process.env.TIKTOK_APP_SECRET;
  if (!appId || !secret) {
    return { ok: false, error: "TIKTOK_APP_ID / TIKTOK_APP_SECRET em falta no servidor." };
  }
  const res = await fetch(`${TIKTOK_BASE}/${REFRESH_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      secret,
      refresh_token: refreshToken,
    }),
  });
  const j = (await res.json()) as RefreshJson;
  if (!res.ok) {
    paidLog("error", "tiktok.oauth.refresh.http", {
      connectionId,
      status: res.status,
      requestId: j.request_id,
    });
    return { ok: false, error: j.message ?? `TikTok refresh HTTP ${res.status}`, requestId: j.request_id };
  }
  if (j.code !== 0 || !j.data?.access_token) {
    paidLog("error", "tiktok.oauth.refresh.api", {
      connectionId,
      code: j.code,
      message: j.message,
      requestId: j.request_id,
    });
    return {
      ok: false,
      error: j.message ?? (typeof j.code === "number" ? `TikTok code ${j.code}` : "Falha ao renovar o token"),
      requestId: j.request_id,
    };
  }
  const newAccess = j.data.access_token;
  const newRefresh = j.data.refresh_token ?? refreshToken;
  await prisma.paidAdsTikTokConnection.update({
    where: { id: connectionId },
    data: {
      tokenRef: newAccess,
      refreshTokenRef: newRefresh,
      lastSyncAt: new Date(),
      errorMessage: null,
    },
  });
  paidLog("info", "tiktok.oauth.refresh.ok", { connectionId, requestId: j.request_id });
  return { ok: true, accessToken: newAccess, refreshToken: newRefresh };
}

/**
 * Garante um access token utilizável, renovando com refresh se necessário.
 */
export async function ensureTikTokAccessToken(projectId: string): Promise<
  | { ok: true; accessToken: string; advertiserId: string; connectionId: string }
  | { ok: false; error: string }
> {
  const conn = await prisma.paidAdsTikTokConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.advertiserId) {
    return { ok: false, error: "Ligue a conta TikTok (OAuth) e o advertiser em contexto." };
  }
  if (!conn.tokenRef) {
    return { ok: false, error: "Token em falta. Volte a ligar o TikTok (OAuth) na app." };
  }
  if (!conn.refreshTokenRef) {
    return { ok: true, accessToken: conn.tokenRef, advertiserId: conn.advertiserId, connectionId: conn.id };
  }
  const last = conn.lastSyncAt?.getTime() ?? 0;
  const stale = Date.now() - last > PROACTIVE_REFRESH_AFTER_MS;
  if (stale) {
    const r = await refreshTikTokAccessToken(conn.id, conn.refreshTokenRef);
    if (r.ok) {
      return {
        ok: true,
        accessToken: r.accessToken,
        advertiserId: conn.advertiserId,
        connectionId: conn.id,
      };
    }
    await prisma.paidAdsTikTokConnection.update({
      where: { id: conn.id },
      data: {
        status: "error",
        errorMessage: r.error.slice(0, 500),
      },
    });
    return {
      ok: false,
      error: `Token TikTok inválido ou expirado: ${r.error} Volte a ligar a conta em «Ligações».`,
    };
  }
  return { ok: true, accessToken: conn.tokenRef, advertiserId: conn.advertiserId, connectionId: conn.id };
}

/** Códigos / mensagens que sugerem access token inválido — tenta refresh uma vez. */
function looksLikeTiktokAuthError(code: number, message: string): boolean {
  if (code === 40002) return true;
  const m = message.toLowerCase();
  if (m.includes("access_token") || m.includes("access token") || m.includes("invalid credential")) return true;
  if (m.includes("oauth") && m.includes("invalid")) return true;
  return false;
}

export type TikTokApiResponse<T> = {
  code: number;
  message: string;
  data?: T;
  request_id?: string;
};

/**
 * Corre o pedido com o token corrente; se falhar por auth e existir refresh, renova e repete uma vez.
 */
async function tiktokWithTokenRetry<T>(
  projectId: string,
  path: string,
  run: (token: string) => Promise<TikTokApiResponse<T>>,
): Promise<TikTokApiResponse<T>> {
  const first = await ensureTikTokAccessToken(projectId);
  if (!first.ok) {
    return { code: 40001, message: first.error };
  }
  let env = await run(first.accessToken);
  if (env.code === 0) return env;

  const conn = await prisma.paidAdsTikTokConnection.findUnique({ where: { projectId } });
  if (conn?.refreshTokenRef && looksLikeTiktokAuthError(env.code, env.message)) {
    paidLog("warn", "tiktok.api.retry_after_refresh", {
      projectId,
      path,
      code: env.code,
      requestId: env.request_id,
    });
    const r = await refreshTikTokAccessToken(conn.id, conn.refreshTokenRef);
    if (r.ok) {
      env = await run(r.accessToken);
    }
  }
  return env;
}

export function tiktokApiPostWithTokenRetry<T>(
  projectId: string,
  path: string,
  body: object,
): Promise<TikTokApiResponse<T>> {
  return tiktokWithTokenRetry<T>(projectId, path, (token) =>
    fetch(`${TIKTOK_BASE}/${path.replace(/^\//, "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<TikTokApiResponse<T>>),
  );
}

/** Query string da Marketing API: listas e objectos vão em JSON (ex.: `video_ids=["x"]`). */
export function tiktokQueryString(query: Record<string, string | number | string[]>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    qs.set(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  return qs.toString();
}

export function tiktokApiGetWithTokenRetry<T>(
  projectId: string,
  path: string,
  query: Record<string, string | number | string[]>,
): Promise<TikTokApiResponse<T>> {
  const qs = tiktokQueryString(query);
  return tiktokWithTokenRetry<T>(projectId, path, (token) =>
    fetch(`${TIKTOK_BASE}/${path.replace(/^\//, "")}?${qs}`, {
      method: "GET",
      headers: { "Access-Token": token },
    }).then((r) => r.json() as Promise<TikTokApiResponse<T>>),
  );
}

/**
 * Upload multipart (`file/video/ad/upload/`, `file/image/ad/upload/`).
 * `Content-Type` fica a cargo do runtime para incluir o boundary do FormData.
 */
export function tiktokApiUploadWithTokenRetry<T>(
  projectId: string,
  path: string,
  form: FormData,
): Promise<TikTokApiResponse<T>> {
  return tiktokWithTokenRetry<T>(projectId, path, (token) =>
    fetch(`${TIKTOK_BASE}/${path.replace(/^\//, "")}`, {
      method: "POST",
      headers: { "Access-Token": token },
      body: form,
    }).then((r) => r.json() as Promise<TikTokApiResponse<T>>),
  );
}

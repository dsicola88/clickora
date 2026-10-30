import type { Request } from "express";
import { verifyPostbackToken } from "./postbackToken";

export type AdsPostbackAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

/**
 * Autentica postbacks Google/Microsoft Ads.
 * Token JWT por conta → userId do token.
 * Token global de env → exige `user_id` no body/query (evita escrita cross-tenant).
 */
export function resolveAdsPostbackAuth(
  req: Request,
  envToken: string | undefined,
): AdsPostbackAuthResult {
  const incoming = req.headers["x-postback-token"]?.toString() || req.query.token?.toString();

  if (envToken) {
    if (!incoming || incoming !== envToken) {
      return { ok: false, status: 401, error: "Token de postback inválido" };
    }
    const rawUser =
      (typeof req.body?.user_id === "string" && req.body.user_id.trim()) ||
      (typeof req.query.user_id === "string" && String(req.query.user_id).trim()) ||
      "";
    if (!rawUser) {
      return {
        ok: false,
        status: 400,
        error: "user_id obrigatório com token global de postback",
      };
    }
    return { ok: true, userId: rawUser };
  }

  if (!incoming) {
    return { ok: false, status: 401, error: "Token de postback obrigatório" };
  }
  const decoded = verifyPostbackToken(incoming);
  if (!decoded?.userId) {
    return { ok: false, status: 401, error: "Token de postback inválido" };
  }
  return { ok: true, userId: decoded.userId };
}

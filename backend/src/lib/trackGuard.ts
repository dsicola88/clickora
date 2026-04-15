import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { normalizeIpForMatch } from "./normalizeIp";
import { detectBot } from "./detectBot";
import { consumeTrackRateLimit } from "./trackRateLimit";

/** Mantém compat com relatórios que filtram `platform: blacklist_block`. */
export async function logBlacklistBlock(params: {
  userId: string;
  presellPageId?: string;
  ip: string;
  userAgent: string;
  channel: TrackingGuardChannel;
}): Promise<void> {
  try {
    await systemPrisma.postbackLog.create({
      data: {
        userId: params.userId,
        presellPageId: params.presellPageId ?? null,
        platform: "blacklist_block",
        status: "blocked",
        message: `IP na blacklist (${params.channel})`,
        payload: {
          ip: params.ip,
          user_agent: params.userAgent,
          channel: params.channel,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[logBlacklistBlock]", e);
  }
}

export type TrackingGuardChannel =
  | "redirect"
  | "api_click"
  | "pixel"
  | "impression_api"
  | "track_event";

/**
 * Regras globais de tracking (IP): rate limit → blacklist → whitelist (se ativa) → UA vazio → bots (opt-in).
 * Default seguro: apenas rate limit aplica sempre; resto depende de flags na conta ou listas.
 */
export async function enforceTrackingRules(args: {
  ownerUserId: string;
  presellPageId: string | null;
  ip: string;
  userAgent: string;
  channel: TrackingGuardChannel;
}): Promise<
  | { ok: true; ipKey: string }
  | {
      ok: false;
      status: number;
      error: string;
      /** Para logs / métricas */
      reason: "rate_limit" | "blacklist" | "whitelist" | "empty_user_agent" | "bot_blocked";
    }
> {
  const { ownerUserId, presellPageId, userAgent, channel } = args;
  const ip = args.ip || "";
  const ipKeyForLog = normalizeIpForMatch(ip);

  if (!consumeTrackRateLimit(ip)) {
    void logGuardBlock({
      ownerUserId,
      presellPageId,
      channel,
      reason: "rate_limit",
      detail: "Demasiados pedidos neste IP. Tente mais tarde.",
      ip: ipKeyForLog,
    });
    return {
      ok: false,
      status: 429,
      error: "Demasiados pedidos. Tente mais tarde.",
      reason: "rate_limit",
    };
  }

  const ipKey = ipKeyForLog;

  const blacklisted = await systemPrisma.blacklistedIp.findUnique({
    where: { userId_ipAddress: { userId: ownerUserId, ipAddress: ipKey } },
  });
  if (blacklisted) {
    void logBlacklistBlock({
      userId: ownerUserId,
      presellPageId: presellPageId ?? undefined,
      ip: ipKey,
      userAgent,
      channel,
    });
    return { ok: false, status: 403, error: "IP bloqueado", reason: "blacklist" };
  }

  const owner = await systemPrisma.user.findUnique({
    where: { id: ownerUserId },
    select: {
      blockEmptyUserAgent: true,
      blockBotClicks: true,
      _count: { select: { whitelistedIps: true } },
    },
  });

  if (!owner) {
    return { ok: false, status: 403, error: "Tracking indisponível", reason: "blacklist" };
  }

  const wlCount = owner._count.whitelistedIps;
  if (wlCount > 0) {
    const allowed = await systemPrisma.whitelistedIp.findUnique({
      where: { userId_ipAddress: { userId: ownerUserId, ipAddress: ipKey } },
    });
    if (!allowed) {
    void logGuardBlock({
      ownerUserId,
      presellPageId,
      channel,
      reason: "whitelist",
      detail: "IP fora da whitelist (modo restrito ativo)",
      ip: ipKey,
    });
      return {
        ok: false,
        status: 403,
        error: "IP não autorizado para tracking",
        reason: "whitelist",
      };
    }
  }

  if (owner.blockEmptyUserAgent && !String(userAgent).trim()) {
    void logGuardBlock({
      ownerUserId,
      presellPageId,
      channel,
      reason: "empty_user_agent",
      detail: "User-Agent vazio (regra da conta)",
      ip: ipKey,
    });
    return {
      ok: false,
      status: 403,
      error: "Pedido sem User-Agent",
      reason: "empty_user_agent",
    };
  }

  if (owner.blockBotClicks) {
    const b = detectBot(userAgent);
    if (b.isBot) {
      void logGuardBlock({
        ownerUserId,
        presellPageId,
        channel,
        reason: "bot_blocked",
        detail: `Bot: ${b.label}`,
        ip: ipKey,
      });
      return {
        ok: false,
        status: 403,
        error: "Pedido identificado como bot",
        reason: "bot_blocked",
      };
    }
  }

  return { ok: true, ipKey };
}

async function logGuardBlock(args: {
  ownerUserId: string;
  presellPageId: string | null;
  channel: TrackingGuardChannel;
  reason: string;
  detail: string;
  ip?: string;
}): Promise<void> {
  try {
    await systemPrisma.postbackLog.create({
      data: {
        userId: args.ownerUserId,
        presellPageId: args.presellPageId,
        platform: "tracking_guard",
        status: args.reason,
        message: args.detail.slice(0, 500),
        payload: {
          channel: args.channel,
          reason: args.reason,
          ip: args.ip ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[trackGuard] log", e);
  }
}

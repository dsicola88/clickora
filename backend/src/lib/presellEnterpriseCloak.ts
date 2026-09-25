import type { Request } from "express";
import { detectBot } from "./detectBot";
import { countryIsoFromIp } from "./countryFromIp";
import { extractClientIp } from "./clientIp";

export type CloakSettings = {
  enterpriseCloak?: boolean;
  cloakSafeTitle?: string;
  cloakSafeBody?: string;
  /** ISO country codes comma-separated — esses países vêem a safe page. */
  cloakGeoDeny?: string;
};

function parseSettings(raw: unknown): CloakSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const s = raw as Record<string, unknown>;
  return {
    enterpriseCloak: s.enterpriseCloak === true || s.enterpriseCloak === "true",
    cloakSafeTitle: typeof s.cloakSafeTitle === "string" ? s.cloakSafeTitle : undefined,
    cloakSafeBody: typeof s.cloakSafeBody === "string" ? s.cloakSafeBody : undefined,
    cloakGeoDeny: typeof s.cloakGeoDeny === "string" ? s.cloakGeoDeny : undefined,
  };
}

/**
 * Cloaking enterprise: bots / geo deny → página limpa (sem mirror, sem hoplink).
 * Humanos normais → presell completa. Não é “invisível” a revisores humanos.
 */
export function shouldServeCloakSafePage(
  req: Request,
  settingsRaw: unknown,
): { cloak: true; reason: string } | { cloak: false } {
  const settings = parseSettings(settingsRaw);
  if (!settings.enterpriseCloak) return { cloak: false };

  const ua = req.headers["user-agent"]?.toString() || "";
  const bot = detectBot(ua);
  if (bot.isBot) {
    return { cloak: true, reason: `bot:${bot.label}` };
  }

  const denyRaw = (settings.cloakGeoDeny || "")
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (denyRaw.length > 0) {
    const ip = extractClientIp(req);
    const country = countryIsoFromIp(ip)?.toUpperCase();
    if (country && denyRaw.includes(country)) {
      return { cloak: true, reason: `geo:${country}` };
    }
  }

  return { cloak: false };
}

export function buildCloakSafePublicPayload(args: {
  base: Record<string, unknown>;
  settingsRaw: unknown;
  reason: string;
}): Record<string, unknown> {
  const settings = parseSettings(args.settingsRaw);
  const title =
    (settings.cloakSafeTitle || "").trim() ||
    (typeof args.base.title === "string" && args.base.title.trim()
      ? String(args.base.title).trim()
      : "Informação");
  const body =
    (settings.cloakSafeBody || "").trim() ||
    "Conteúdo informativo. Para mais detalhes, contacte o responsável pela página.";

  return {
    ...args.base,
    cloak_safe: true,
    cloak_reason: args.reason,
    type: "tsl",
    content: {
      title,
      subtitle: "",
      salesText: body,
      ctaText: "",
      images: [],
      affiliateLink: "#",
      importMirrorSrcDoc: "",
    },
    settings: {
      ...(typeof args.base.settings === "object" && args.base.settings && !Array.isArray(args.base.settings)
        ? (args.base.settings as Record<string, unknown>)
        : {}),
      enterpriseCloak: true,
      exitPopup: false,
      countdownTimer: false,
      socialProof: false,
    },
  };
}

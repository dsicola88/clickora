import { Prisma } from "@prisma/client";
import { z } from "zod";
import { systemPrisma } from "./prisma";
import { countryIsoFromIp } from "./countryFromIp";
import { assessClickQuality } from "./detectBot";
import { formatDeviceLabel, parseUserAgent } from "./parseUserAgent";

export const FUNNEL_STEPS = ["checkout", "lander"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export function isFunnelStep(v: string | undefined | null): v is FunnelStep {
  return v === "checkout" || v === "lander";
}

/**
 * Eventos de funil (checkout / lander) — NÃO são vendas.
 * Detecta status/event/funnel_step vindos de Event postbacks (ex.: SmartAdv).
 */
export function detectFunnelStepFromPayload(flat: Record<string, string>): FunnelStep | null {
  const funnelExplicit = (flat.funnel_step || flat.funnel || "").trim().toLowerCase();
  if (isFunnelStep(funnelExplicit)) return funnelExplicit;

  const keys = ["event", "event_name", "event_type", "goal", "action", "status", "conversion_type"];
  for (const k of keys) {
    const raw = (flat[k] || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!raw) continue;
    if (
      raw === "checkout" ||
      raw === "initiate_checkout" ||
      raw === "initiatecheckout" ||
      raw === "ofi" ||
      raw === "order_form" ||
      raw === "orderform" ||
      raw.includes("checkout")
    ) {
      return "checkout";
    }
    if (
      raw === "lander" ||
      raw === "landing" ||
      raw === "vsl" ||
      raw === "view_content" ||
      raw === "viewcontent" ||
      raw === "lp_view" ||
      raw === "landing_page"
    ) {
      return "lander";
    }
  }
  return null;
}

function deviceAndBotMeta(
  userAgent: string,
  opts?: { headers?: Record<string, string | string[] | undefined>; ip?: string | null },
) {
  const parsed = parseUserAgent(userAgent);
  const q = assessClickQuality({
    userAgent,
    headers: opts?.headers,
    ip: opts?.ip ?? undefined,
  });
  const botMeta: Record<string, unknown> = {
    fraud_score: q.fraud_score,
    fraud_flags: q.fraud_flags,
    browser: parsed.browser,
    os: parsed.os,
    device_label: formatDeviceLabel(parsed),
  };
  if (q.is_bot) {
    botMeta.is_bot = true;
    botMeta.bot_label = q.bot_label;
  }
  if (q.is_proxy_suspect) botMeta.is_proxy_suspect = true;
  if (q.is_bot) return { device: "bot", botMeta };
  return { device: parsed.device, botMeta };
}

/**
 * Regista lead de funil (checkout/lander). Dedupa 24h por clique ou IP.
 * Não cria conversão nem incrementa vendas.
 */
export async function recordAffiliateFunnelStep(args: {
  userId: string;
  step: FunnelStep;
  platform?: string | null;
  clickIdCandidate?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  headers?: Record<string, string | string[] | undefined>;
  extraMeta?: Record<string, unknown>;
}): Promise<{ recorded: boolean; duplicate: boolean; eventId: string | null }> {
  const ua = args.userAgent || "";
  const ip = args.ip ?? null;

  let click: {
    id: string;
    presellPageId: string | null;
    metadata: Prisma.JsonValue;
    source: string | null;
    medium: string | null;
    campaign: string | null;
    referrer: string | null;
  } | null = null;

  const candidate = (args.clickIdCandidate || "").trim();
  if (candidate && z.string().uuid().safeParse(candidate).success) {
    click = await systemPrisma.trackingEvent.findFirst({
      where: { id: candidate, userId: args.userId, eventType: "click" },
      select: {
        id: true,
        presellPageId: true,
        metadata: true,
        source: true,
        medium: true,
        campaign: true,
        referrer: true,
      },
    });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dedupeOr: Prisma.TrackingEventWhereInput[] = click
    ? [{ metadata: { path: ["attributed_click_id"], equals: click.id } }]
    : ip
      ? [{ ipAddress: ip }]
      : [];

  if (dedupeOr.length > 0) {
    const dup = await systemPrisma.trackingEvent.findFirst({
      where: {
        userId: args.userId,
        eventType: "lead",
        createdAt: { gte: since },
        AND: [{ metadata: { path: ["funnel_step"], equals: args.step } }, { OR: dedupeOr }],
      },
      select: { id: true },
    });
    if (dup) return { recorded: false, duplicate: true, eventId: dup.id };
  }

  const clickMeta = (click?.metadata || {}) as Record<string, unknown>;
  const redirectTo =
    typeof clickMeta.redirect_to === "string" && clickMeta.redirect_to.trim()
      ? clickMeta.redirect_to.trim()
      : null;

  const { device, botMeta } = deviceAndBotMeta(ua, { headers: args.headers, ip });
  const platform = (args.platform || "affiliate").trim() || "affiliate";

  const created = await systemPrisma.trackingEvent.create({
    data: {
      userId: args.userId,
      presellPageId: click?.presellPageId ?? undefined,
      eventType: "lead",
      source: click?.source ?? platform.toLowerCase(),
      medium: click?.medium ?? "funnel",
      campaign: click?.campaign ?? undefined,
      referrer: click?.referrer ?? args.referrer ?? undefined,
      country: countryIsoFromIp(ip) ?? undefined,
      ipAddress: ip ?? undefined,
      userAgent: ua || undefined,
      device,
      metadata: {
        funnel_step: args.step,
        platform,
        attributed_click_id: click?.id ?? null,
        redirect_to: redirectTo,
        ...botMeta,
        ...(args.extraMeta || {}),
      } as Prisma.InputJsonValue,
    },
  });

  return { recorded: true, duplicate: false, eventId: created.id };
}

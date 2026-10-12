import type { Request, Response } from "express";
import { extractClientIp } from "./clientIp";
import { resolveVisitorCountryFromRequest } from "./cdn77Visitor";

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

/** Países da lista desta presell. O User-Agent não muda a página. */
export function countryOnCloakDenyList(settingsRaw: unknown, country: string | null | undefined): boolean {
  const settings = parseSettings(settingsRaw);
  if (!settings.enterpriseCloak) return false;
  const denyRaw = (settings.cloakGeoDeny || "")
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (denyRaw.length === 0) return false;
  const code = (country || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && denyRaw.includes(code);
}

/**
 * Página segura por país configurado nesta presell.
 * Bot, IP e proxy seguem as regras da conta, não o User-Agent desta função.
 */
export function shouldServeCloakSafePage(
  req: Request,
  settingsRaw: unknown,
): { cloak: true; reason: string } | { cloak: false } {
  const ip = extractClientIp(req);
  const country = resolveVisitorCountryFromRequest(req, ip).country;
  if (countryOnCloakDenyList(settingsRaw, country)) {
    return { cloak: true, reason: `geo:${country}` };
  }
  return { cloak: false };
}

export function safeCopyFromSettings(settingsRaw: unknown): { title: string; body: string } {
  const settings = parseSettings(settingsRaw);
  const title = (settings.cloakSafeTitle || "").trim() || "Informação";
  const body =
    (settings.cloakSafeBody || "").trim() ||
    "Conteúdo informativo. Para mais detalhes, contacte o responsável pela página.";
  return { title, body };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeVisitorHtml(title: string, body: string): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${safeTitle}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1>${safeTitle}</h1><p>${safeBody}</p></body></html>`;
}

/** Visitante filtrado: HTML sem hoplink. O motivo fica no log, não na página. */
export function sendSafeVisitorPage(res: Response, settingsRaw: unknown): void {
  const copy = safeCopyFromSettings(settingsRaw);
  res.status(403).type("html").send(safeVisitorHtml(copy.title, copy.body));
}

export function buildCloakSafePublicPayload(args: {
  base: Record<string, unknown>;
  settingsRaw: unknown;
  reason: string;
}): Record<string, unknown> {
  const copy = safeCopyFromSettings(args.settingsRaw);
  void args.reason;

  return {
    id: args.base.id,
    slug: args.base.slug,
    status: args.base.status,
    language: args.base.language,
    footer_branding: args.base.footer_branding,
    tenant_branding: args.base.tenant_branding ?? null,
    custom_domain_id: args.base.custom_domain_id ?? null,
    cloak_safe: true,
    title: copy.title,
    type: "tsl",
    category: "",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    video_url: undefined,
    content: {
      title: copy.title,
      subtitle: "",
      salesText: copy.body,
      ctaText: "",
      images: [],
      productImages: [],
      affiliateLink: "#",
      importMirrorSrcDoc: "",
    },
    settings: {
      enterpriseCloak: true,
      exitPopup: false,
      countdownTimer: false,
      socialProof: false,
    },
    tracking: {},
    created_at: args.base.created_at,
    updated_at: args.base.updated_at,
  };
}

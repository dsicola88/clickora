import { Request, Response } from "express";
import { z } from "zod";
import { systemPrisma } from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { evaluateSubscriptionAccess } from "../lib/subscription";

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Cor inválida")
  .optional()
  .nullable();

export const tenantBrandingController = {
  async getMine(req: Request, res: Response) {
    const userId = billingUserId(req);
    const row = await systemPrisma.tenantBranding.findUnique({ where: { userId } });
    res.json({
      brand_name: row?.brandName ?? null,
      logo_url: row?.logoUrl ?? null,
      favicon_url: row?.faviconUrl ?? null,
      primary_color: row?.primaryColor ?? null,
      accent_color: row?.accentColor ?? null,
      hide_powered_by: row?.hidePoweredBy ?? true,
      updated_at: row?.updatedAt ?? null,
    });
  },

  async upsertMine(req: Request, res: Response) {
    const userId = billingUserId(req);
    const billing = await systemPrisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    const access = evaluateSubscriptionAccess(billing?.subscription ?? null);
    const plan = billing?.subscription?.plan;
    /** `hasBranding === false` no plano = pode remover marca dclickora / white-label. */
    const canWhiteLabel = Boolean(access.allowed && plan && plan.hasBranding === false);
    if (!canWhiteLabel) {
      return res.status(403).json({
        error: "White-label disponível nos planos Pro. Faça upgrade para personalizar a marca.",
        code: "TENANT_BRANDING_PLAN",
      });
    }

    const parsed = z
      .object({
        brand_name: z.string().trim().max(120).optional().nullable(),
        logo_url: z.string().url().max(2000).optional().nullable().or(z.literal("")),
        favicon_url: z.string().url().max(2000).optional().nullable().or(z.literal("")),
        primary_color: hexColor,
        accent_color: hexColor,
        hide_powered_by: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const row = await systemPrisma.tenantBranding.upsert({
      where: { userId },
      create: {
        userId,
        brandName: d.brand_name || null,
        logoUrl: d.logo_url || null,
        faviconUrl: d.favicon_url || null,
        primaryColor: d.primary_color || null,
        accentColor: d.accent_color || null,
        hidePoweredBy: d.hide_powered_by ?? true,
      },
      update: {
        ...(d.brand_name !== undefined && { brandName: d.brand_name || null }),
        ...(d.logo_url !== undefined && { logoUrl: d.logo_url || null }),
        ...(d.favicon_url !== undefined && { faviconUrl: d.favicon_url || null }),
        ...(d.primary_color !== undefined && { primaryColor: d.primary_color || null }),
        ...(d.accent_color !== undefined && { accentColor: d.accent_color || null }),
        ...(d.hide_powered_by !== undefined && { hidePoweredBy: d.hide_powered_by }),
      },
    });
    res.json({
      brand_name: row.brandName,
      logo_url: row.logoUrl,
      favicon_url: row.faviconUrl,
      primary_color: row.primaryColor,
      accent_color: row.accentColor,
      hide_powered_by: row.hidePoweredBy,
      updated_at: row.updatedAt,
    });
  },
};

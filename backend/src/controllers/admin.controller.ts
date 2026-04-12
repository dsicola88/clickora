import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type { AppRole, PlanType, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { prismaAdmin } from "../lib/prisma";

function parseDateInput(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error("invalid_date");
  return d;
}

const updatePlanSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  price_cents: z.number().int().min(0).optional(),
  max_presell_pages: z.number().int().min(0).nullable().optional(),
  max_clicks_per_month: z.number().int().min(0).nullable().optional(),
  has_branding: z.boolean().optional(),
  features: z.array(z.string().max(500)).max(50).optional(),
  cta_label: z.union([z.string().trim().min(1).max(160), z.null()]).optional(),
});

const updateSubscriptionSchema = z.object({
  starts_at: z.string().optional(),
  ends_at: z.union([z.string(), z.null()]).optional(),
});

const setPasswordSchema = z.object({
  new_password: z.string().min(6).max(128),
});

function seriesLast30Days(rows: { createdAt: Date }[]): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const out: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export const adminController = {
  async getAllUsers(_req: Request, res: Response) {
    const users = await prismaAdmin.user.findMany({
      include: {
        roles: true,
        subscription: { include: { plan: true } },
        _count: { select: { presellPages: true, trackingEvents: true, conversions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    res.json(
      users.map((u) => {
        const ends = u.subscription?.endsAt ?? null;
        const endsPassed = Boolean(ends && ends < now);
        return {
          user_id: u.id,
          email: u.email,
          full_name: u.fullName,
          role: (u.roles[0]?.role ?? "user") as AppRole,
          plan_name: u.subscription?.plan.name || null,
          plan_type: (u.subscription?.plan.type ?? null) as PlanType | null,
          plan_id: u.subscription?.planId ?? null,
          sub_status: (u.subscription?.status ?? null) as SubscriptionStatus | null,
          sub_starts_at: u.subscription?.startsAt?.toISOString() ?? null,
          sub_ends_at: ends?.toISOString() ?? null,
          /** Data de fim já ultrapassada (calendário), independentemente do estado guardado. */
          ends_at_passed: endsPassed,
          pages_count: u._count.presellPages,
          events_count: u._count.trackingEvents,
          conversions_count: u._count.conversions,
          created_at: u.createdAt.toISOString(),
        };
      }),
    );
  },

  async getPlans(_req: Request, res: Response) {
    const plans = await prismaAdmin.plan.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
    res.json(
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price_cents: p.priceCents,
        max_presell_pages: p.maxPresellPages,
        max_clicks_per_month: p.maxClicksPerMonth,
        has_branding: p.hasBranding,
        features: Array.isArray(p.features) ? p.features.map((x) => String(x)) : [],
        cta_label: p.ctaLabel ?? null,
      })),
    );
  },

  async getOverview(_req: Request, res: Response) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 29);
    since.setUTCHours(0, 0, 0, 0);

    const [totalUsers, activeSubs, totalPresells, totalEvents, totalConversions, recentUsers, recentConversions] =
      await Promise.all([
        prismaAdmin.user.count(),
        prismaAdmin.subscription.count({ where: { status: "active" } }),
        prismaAdmin.presellPage.count(),
        prismaAdmin.trackingEvent.count(),
        prismaAdmin.conversion.count(),
        prismaAdmin.user.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        prismaAdmin.conversion.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      ]);

    const now = new Date();
    const in14d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const expiringSoon = await prismaAdmin.subscription.count({
      where: {
        status: "active",
        AND: [{ endsAt: { not: null } }, { endsAt: { lte: in14d, gte: now } }],
      },
    });

    res.json({
      total_users: totalUsers,
      active_users: activeSubs,
      total_presells: totalPresells,
      total_events: totalEvents,
      total_conversions: totalConversions,
      subscriptions_expiring_14d: expiringSoon,
      signups_by_day: seriesLast30Days(recentUsers),
      conversions_by_day: seriesLast30Days(recentConversions),
    });
  },

  async suspendUser(req: Request, res: Response) {
    const { userId } = req.params;
    const sub = await prismaAdmin.subscription.findUnique({ where: { userId } });
    if (!sub) return res.status(404).json({ error: "Usuário sem assinatura" });

    await prismaAdmin.subscription.update({
      where: { id: sub.id },
      data: { status: "suspended" },
    });

    res.json({ message: "Usuário suspenso" });
  },

  async reactivateUser(req: Request, res: Response) {
    const { userId } = req.params;
    const sub = await prismaAdmin.subscription.findUnique({ where: { userId } });
    if (!sub) return res.status(404).json({ error: "Usuário sem assinatura" });

    await prismaAdmin.subscription.update({
      where: { id: sub.id },
      data: { status: "active" },
    });

    res.json({ message: "Usuário reativado" });
  },

  async getMetrics(_req: Request, res: Response) {
    const [totalUsers, activeUsers, totalPresells, totalEvents] = await Promise.all([
      prismaAdmin.user.count(),
      prismaAdmin.subscription.count({ where: { status: "active" } }),
      prismaAdmin.presellPage.count(),
      prismaAdmin.trackingEvent.count(),
    ]);

    res.json({ total_users: totalUsers, active_users: activeUsers, total_presells: totalPresells, total_events: totalEvents });
  },

  async updateUserPlan(req: Request, res: Response) {
    const { userId } = req.params;
    const { plan_type } = req.body as { plan_type?: string };

    const allowed: PlanType[] = ["free_trial", "monthly", "quarterly", "annual"];
    if (!plan_type || !allowed.includes(plan_type as PlanType)) {
      return res.status(400).json({ error: "plan_type inválido" });
    }

    const plan = await prismaAdmin.plan.findFirst({ where: { type: plan_type as PlanType } });
    if (!plan) return res.status(404).json({ error: "Plano não encontrado" });

    await prismaAdmin.subscription.upsert({
      where: { userId },
      create: { userId, planId: plan.id, status: "active" },
      update: { planId: plan.id },
    });

    res.json({ message: "Plano do usuário atualizado" });
  },

  /** Apenas super_admin — preços e limites comerciais. */
  async updatePlan(req: Request, res: Response) {
    const { planId } = req.params;
    const parsed = updatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const existing = await prismaAdmin.plan.findUnique({ where: { id: planId } });
    if (!existing) return res.status(404).json({ error: "Plano não encontrado" });

    const p = parsed.data;
    if (
      p.name === undefined &&
      p.price_cents === undefined &&
      p.max_presell_pages === undefined &&
      p.max_clicks_per_month === undefined &&
      p.has_branding === undefined &&
      p.features === undefined &&
      p.cta_label === undefined
    ) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    await prismaAdmin.plan.update({
      where: { id: planId },
      data: {
        ...(p.name !== undefined ? { name: p.name } : {}),
        ...(p.price_cents !== undefined ? { priceCents: p.price_cents } : {}),
        ...(p.max_presell_pages !== undefined ? { maxPresellPages: p.max_presell_pages } : {}),
        ...(p.max_clicks_per_month !== undefined ? { maxClicksPerMonth: p.max_clicks_per_month } : {}),
        ...(p.has_branding !== undefined ? { hasBranding: p.has_branding } : {}),
        ...(p.features !== undefined ? { features: p.features } : {}),
        ...(p.cta_label !== undefined ? { ctaLabel: p.cta_label } : {}),
      },
    });

    res.json({ message: "Plano atualizado" });
  },

  /** Datas da assinatura (início / fim); `ends_at` null remove a data de expiração. */
  async updateUserSubscription(req: Request, res: Response) {
    const { userId } = req.params;
    const parsed = updateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const sub = await prismaAdmin.subscription.findUnique({ where: { userId } });
    if (!sub) return res.status(404).json({ error: "Utilizador sem assinatura" });

    const { starts_at, ends_at } = parsed.data;
    if (starts_at === undefined && ends_at === undefined) {
      return res.status(400).json({ error: "Envie starts_at e/ou ends_at" });
    }

    try {
      const data: {
        startsAt?: Date;
        endsAt?: Date | null;
      } = {};

      if (starts_at !== undefined) {
        data.startsAt = parseDateInput(starts_at);
      }
      if (ends_at !== undefined) {
        data.endsAt = ends_at === null ? null : parseDateInput(ends_at);
      }

      await prismaAdmin.subscription.update({
        where: { id: sub.id },
        data,
      });
    } catch {
      return res.status(400).json({ error: "Formato de data inválido (use AAAA-MM-DD ou ISO)" });
    }

    res.json({ message: "Assinatura atualizada" });
  },

  /**
   * Redefinir senha de um assinante (ou staff). Super admin: qualquer conta.
   * Admin normal: só contas com função `user` ou `moderator` (não altera outros admins).
   */
  async setUserPassword(req: Request, res: Response) {
    const { userId } = req.params;
    const parsed = setPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Senha inválida (mín. 6 caracteres)", details: parsed.error.flatten() });
    }

    const target = await prismaAdmin.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!target) return res.status(404).json({ error: "Utilizador não encontrado" });

    const requesterRoles = await prismaAdmin.userRole.findMany({
      where: { userId: req.user!.userId },
      select: { role: true },
    });
    const requesterIsSuper = requesterRoles.some((r) => r.role === "super_admin");

    const targetIsSuper = target.roles.some((r) => r.role === "super_admin");
    const targetIsAdmin = target.roles.some((r) => r.role === "admin");

    if (targetIsSuper && !requesterIsSuper) {
      return res.status(403).json({ error: "Apenas o super administrador pode alterar esta senha." });
    }
    if (targetIsAdmin && !requesterIsSuper) {
      return res.status(403).json({ error: "Apenas o super administrador pode alterar senhas de administradores." });
    }

    const hash = await bcrypt.hash(parsed.data.new_password, 12);
    await prismaAdmin.user.update({
      where: { id: userId },
      data: { password: hash },
    });

    res.json({ message: "Senha redefinida. O utilizador deve usar a nova senha no próximo login." });
  },
};

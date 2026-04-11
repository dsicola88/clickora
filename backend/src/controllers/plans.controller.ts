import { Request, Response } from "express";
import prisma, { systemPrisma } from "../lib/prisma";

export const plansController = {
  async getAll(_req: Request, res: Response) {
    const plans = await systemPrisma.plan.findMany({
      orderBy: { priceCents: "asc" },
    });

    res.json(plans.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      price_cents: p.priceCents,
      max_presell_pages: p.maxPresellPages,
      max_clicks_per_month: p.maxClicksPerMonth,
      has_branding: p.hasBranding,
      features: p.features || [],
    })));
  },

  async subscribe(req: Request, res: Response) {
    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ error: "plan_id é obrigatório" });

    const plan = await systemPrisma.plan.findUnique({ where: { id: plan_id } });
    if (!plan) return res.status(404).json({ error: "Plano não encontrado" });

    // For paid plans, integrate with Stripe here
    if (plan.priceCents > 0) {
      // TODO: Create Stripe checkout session
      // return res.json({ checkout_url: stripeSession.url });
      return res.json({ checkout_url: null, message: "Integração de pagamento pendente" });
    }

    // Free plan — update directly
    await prisma.subscription.upsert({
      where: { userId: req.user!.userId },
      create: {
        userId: req.user!.userId,
        planId: plan_id,
        status: "active",
      },
      update: {
        planId: plan_id,
        status: "active",
      },
    });

    res.json({ message: "Plano atualizado com sucesso" });
  },

  async cancel(req: Request, res: Response) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!sub) return res.status(404).json({ error: "Nenhuma assinatura encontrada" });

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "canceled" },
    });

    res.json({ message: "Assinatura cancelada" });
  },
};

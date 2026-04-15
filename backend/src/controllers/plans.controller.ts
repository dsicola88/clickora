import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import prisma, { systemPrisma } from "../lib/prisma";
import { effectiveMaxCustomDomainsFromPlan } from "../lib/customDomainLimits";

/** Sem `cta_label` — para BD antiga antes de `prisma migrate deploy` (evita P2022). */
const planSelectLegacy: Prisma.PlanSelect = {
  id: true,
  name: true,
  type: true,
  priceCents: true,
  maxPresellPages: true,
  maxClicksPerMonth: true,
  hasBranding: true,
  features: true,
  createdAt: true,
  /** Omitido em BD muito antiga (P2022) — o map usa `effectiveMaxCustomDomainsFromPlan`. */
};

async function findManyPlansOrdered() {
  try {
    return await systemPrisma.plan.findMany({
      orderBy: { priceCents: "asc" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return await systemPrisma.plan.findMany({
        select: planSelectLegacy,
        orderBy: { priceCents: "asc" },
      });
    }
    throw e;
  }
}

async function findUniquePlanById(planId: string) {
  try {
    return await systemPrisma.plan.findUnique({ where: { id: planId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return await systemPrisma.plan.findUnique({
        where: { id: planId },
        select: planSelectLegacy,
      });
    }
    throw e;
  }
}

/** Checkout externo (Hotmart, etc.) — Stripe muitas vezes indisponível para Angola; ver docs/PAGAMENTOS-ANGOLA.md */
function resolveExternalCheckoutUrl(planId: string): string | null {
  const perPlan = process.env.HOTMART_PLAN_CHECKOUT_URLS?.trim();
  if (perPlan) {
    try {
      const map = JSON.parse(perPlan) as Record<string, string>;
      const u = map[planId];
      if (typeof u === "string" && u.trim()) return u.trim();
    } catch {
      // ignore invalid JSON
    }
  }
  const single =
    process.env.HOTMART_PRODUCT_URL?.trim() ||
    process.env.PUBLIC_CHECKOUT_URL?.trim() ||
    "";
  return single || null;
}

export const plansController = {
  async getAll(_req: Request, res: Response) {
    const plans = await findManyPlansOrdered();

    res.json(
      plans.map((p) => {
        const external =
          p.priceCents > 0 ? resolveExternalCheckoutUrl(p.id) : null;
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          price_cents: p.priceCents,
          max_presell_pages: p.maxPresellPages,
          max_clicks_per_month: p.maxClicksPerMonth,
          max_custom_domains: effectiveMaxCustomDomainsFromPlan({
            type: p.type,
            maxCustomDomains:
              "maxCustomDomains" in p &&
              typeof (p as { maxCustomDomains?: unknown }).maxCustomDomains === "number"
                ? (p as { maxCustomDomains: number }).maxCustomDomains
                : null,
          }),
          has_branding: p.hasBranding,
          features: Array.isArray(p.features) ? p.features.map((x) => String(x)) : [],
          cta_label: "ctaLabel" in p ? (p.ctaLabel ?? null) : null,
          /** Checkout Hotmart (ou URL pública); visitante pode ir direto sem login — o webhook ativa a assinatura. */
          checkout_url: external,
        };
      }),
    );
  },

  async subscribe(req: Request, res: Response) {
    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ error: "plan_id é obrigatório" });

    const plan = await findUniquePlanById(plan_id);
    if (!plan) return res.status(404).json({ error: "Plano não encontrado" });

    // Planos pagos: checkout na Hotmart (ou URL configurada) — webhook ativa a assinatura
    if (plan.priceCents > 0) {
      const checkout_url = resolveExternalCheckoutUrl(plan_id);
      if (checkout_url) {
        return res.json({
          checkout_url,
          checkout_mode: "external",
          message:
            "Será redirecionado para a página de compra. Após o pagamento aprovado, o acesso é ativado automaticamente (webhook Hotmart). Use o mesmo e-mail na compra e na conta Clickora.",
        });
      }
      return res.json({
        checkout_url: null,
        checkout_mode: "unconfigured",
        message:
          "Configure HOTMART_PRODUCT_URL ou HOTMART_PLAN_CHECKOUT_URLS no servidor (checkout Hotmart). Pagamento com cartão dentro da app (ex. Stripe) não está disponível nesta região — ver docs/PAGAMENTOS-ANGOLA.md",
      });
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

import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import prisma, { systemPrisma } from "../lib/prisma";
import { effectiveMaxCustomDomainsFromPlan } from "../lib/customDomainLimits";
import {
  effectiveMaxTrafficRotatorsFromPlan,
  effectiveMaxWorkspaceMembersFromPlan,
} from "../lib/planSeatRotatorLimits";
import { rewriteKnownStalePhrase } from "../lib/planCommercialText";
import { billingUserId } from "../lib/requestContext";

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
          max_workspace_members: effectiveMaxWorkspaceMembersFromPlan({
            type: p.type,
            maxWorkspaceMembers:
              "maxWorkspaceMembers" in p &&
              typeof (p as { maxWorkspaceMembers?: unknown }).maxWorkspaceMembers === "number"
                ? (p as { maxWorkspaceMembers: number }).maxWorkspaceMembers
                : null,
          }),
          max_traffic_rotators: effectiveMaxTrafficRotatorsFromPlan({
            type: p.type,
            maxTrafficRotators:
              "maxTrafficRotators" in p &&
              typeof (p as { maxTrafficRotators?: unknown }).maxTrafficRotators === "number"
                ? (p as { maxTrafficRotators: number }).maxTrafficRotators
                : null,
          }),
          has_branding: p.hasBranding,
          affiliate_webhook_enabled:
            "affiliateWebhookEnabled" in p &&
            typeof (p as { affiliateWebhookEnabled?: unknown }).affiliateWebhookEnabled === "boolean"
              ? (p as { affiliateWebhookEnabled: boolean }).affiliateWebhookEnabled
              : false,
          dpilot_ads_enabled:
            "dpilotAdsEnabled" in p &&
            typeof (p as { dpilotAdsEnabled?: unknown }).dpilotAdsEnabled === "boolean"
              ? (p as { dpilotAdsEnabled: boolean }).dpilotAdsEnabled
              : false,
          features: Array.isArray(p.features)
            ? p.features.map((x) => rewriteKnownStalePhrase(String(x)))
            : [],
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

    // Só o plano grátis a preço zero ativa aqui. Um plano pago a zero não abre sem a Hotmart.
    if (plan.type === "free_trial" && plan.priceCents === 0) {
      const userId = billingUserId(req);
      const current = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: { select: { type: true, priceCents: true, name: true } } },
      });
      // Conta com plano pago activo não desce sozinha para Starter (evita bypass comercial).
      // Após cancelar / expirar, pode activar o grátis para continuar com limites Starter.
      const paidActive =
        current &&
        current.status === "active" &&
        current.plan.type !== "free_trial" &&
        current.plan.priceCents > 0;
      if (paidActive) {
        return res.status(409).json({
          error:
            "Tem um plano pago activo. Cancele a assinatura na app (e na Hotmart, se aplicável) antes de passar ao plano Starter.",
          code: "PAID_PLAN_ACTIVE",
          current_plan: current.plan.name,
        });
      }

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planId: plan_id,
          status: "active",
        },
        update: {
          planId: plan_id,
          status: "active",
        },
      });
      return res.json({ message: "Plano atualizado com sucesso" });
    }

    if (plan.priceCents <= 0) {
      return res.status(409).json({
        error:
          "Este plano pago está sem preço na página. A adesão fica fechada até haver um preço e o checkout. Isto não altera quem já tem o plano.",
      });
    }

    // Planos pagos: checkout na Hotmart (ou URL configurada) — webhook ativa a assinatura
    if (plan.priceCents > 0) {
      const checkout_url = resolveExternalCheckoutUrl(plan_id);
      if (checkout_url) {
        return res.json({
          checkout_url,
          checkout_mode: "external",
          message:
            "Será redirecionado para a página de compra. Após o pagamento aprovado, o acesso é ativado automaticamente (webhook Hotmart). Use o mesmo e-mail na compra e na conta dclickora.",
        });
      }
      return res.json({
        checkout_url: null,
        checkout_mode: "unconfigured",
        message:
          "O checkout deste plano ainda não está ligado. Contacte o suporte.",
      });
    }
  },

  async cancel(req: Request, res: Response) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: billingUserId(req) },
    });
    if (!sub) return res.status(404).json({ error: "Nenhuma assinatura encontrada" });

    /** Mantém acesso até endsAt se ainda no futuro (período pago). */
    const now = new Date();
    const keepUntil =
      sub.endsAt && sub.endsAt.getTime() > now.getTime() ? sub.endsAt : now;

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "canceled", endsAt: keepUntil },
    });

    const hotmartCancel =
      process.env.HOTMART_CANCEL_URL?.trim() ||
      process.env.HOTMART_PRODUCT_URL?.trim() ||
      null;

    res.json({
      message:
        "Cancelamento registado na Clickora. Se a cobrança é pela Hotmart, confirme também o cancelamento lá para parar renovações.",
      status: "canceled",
      access_until: keepUntil.toISOString(),
      hotmart_cancel_url: hotmartCancel,
      billing_note:
        "O cancelamento in-app não cancela automaticamente a assinatura na Hotmart.",
    });
  },
};

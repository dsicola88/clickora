import { Request, Response } from "express";
import { systemPrisma } from "../lib/prisma";
import { billingUserId } from "../lib/requestContext";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { isR2Configured } from "../lib/r2Storage";

/**
 * Checklist enterprise: o que falta na conta para operar afiliado profissional.
 */
export const onboardingController = {
  async status(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    const access = evaluateSubscriptionAccess(user?.subscription ?? null);
    const plan = user?.subscription?.plan;

    const [presells, domains, rotators, apiKeys, branding, recentClick, recentConv] =
      await Promise.all([
        systemPrisma.presellPage.count({ where: { userId } }),
        systemPrisma.customDomain.count({ where: { userId, status: "verified" } }),
        systemPrisma.trafficRotator.count({ where: { userId, isActive: true } }),
        systemPrisma.apiKey.count({ where: { userId, revokedAt: null } }),
        systemPrisma.tenantBranding.findUnique({ where: { userId } }),
        systemPrisma.trackingEvent.findFirst({
          where: { userId, eventType: "click" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        }),
        systemPrisma.conversion.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        }),
      ]);

    const steps = [
      {
        id: "plan_active",
        label: "Plano activo",
        done: access.allowed,
        href: "/planos",
      },
      {
        id: "presell",
        label: "Criar pelo menos uma presell",
        done: presells >= 1,
        href: "/presells/nova",
      },
      {
        id: "domain",
        label: "Verificar domínio personalizado",
        done: domains >= 1,
        href: "/configuracoes",
        optional: plan?.maxCustomDomains === 0,
      },
      {
        id: "webhook",
        label: "Webhook de afiliados (plano Pro)",
        done: Boolean(plan?.affiliateWebhookEnabled),
        href: "/integracoes/postback",
      },
      {
        id: "first_click",
        label: "Registar o primeiro clique",
        done: Boolean(recentClick),
        href: "/tracking/url-builder",
      },
      {
        id: "first_sale",
        label: "Registar a primeira conversão",
        done: Boolean(recentConv),
        href: "/integracoes/postback",
      },
      {
        id: "mfa",
        label: "Activar MFA (Authenticator)",
        done: Boolean(user?.mfaEnabled),
        href: "/conta",
      },
      {
        id: "api_key",
        label: "Criar API key B2B (opcional)",
        done: apiKeys >= 1,
        href: "/configuracoes",
        optional: true,
      },
      {
        id: "white_label",
        label: "White-label da marca (Pro)",
        done: Boolean(branding?.brandName || branding?.logoUrl),
        href: "/configuracoes",
        optional: plan?.hasBranding !== false,
      },
      {
        id: "rotator",
        label: "Rotador A/B activo (opcional)",
        done: rotators >= 1,
        href: "/tracking/rotadores",
        optional: true,
      },
      {
        id: "r2",
        label: "Armazenamento R2 (imagens)",
        done: isR2Configured(),
        href: "/ajuda",
        optional: true,
      },
    ];

    const required = steps.filter((s) => !s.optional);
    const doneRequired = required.filter((s) => s.done).length;
    const complete = required.every((s) => s.done);

    res.json({
      complete,
      progress: { done: doneRequired, total: required.length },
      steps,
      plan_name: plan?.name ?? null,
    });
  },
};

/**
 * E2E ponta-a-ponta white-label: BD → regras footer → payload pública → contrato FE.
 *
 *   cd backend && npx tsx scripts/e2e-tenant-branding-public.ts
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { resolvePublicFooterBranding } from "../src/lib/publicFooterBranding";

const prisma = new PrismaClient();
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

/** Espelha `mapPresellForPublic` branding (sem HTTP). */
async function publicBrandingSlice(userId: string, pageId: string) {
  const page = await prisma.presellPage.findUniqueOrThrow({
    where: { id: pageId },
    include: { user: { include: { subscription: { include: { plan: true } } } } },
  });
  const branding = await prisma.tenantBranding.findUnique({ where: { userId } });
  const plan = page.user?.subscription?.plan;
  const footer_branding = resolvePublicFooterBranding({
    planHasBranding: plan?.hasBranding,
    hidePoweredBy: branding?.hidePoweredBy,
  });
  const tenant_branding = branding
    ? {
        brand_name: branding.brandName,
        logo_url: branding.logoUrl,
        favicon_url: branding.faviconUrl,
        primary_color: branding.primaryColor,
        accent_color: branding.accentColor,
      }
    : null;
  return { footer_branding, tenant_branding, planHasBranding: plan?.hasBranding };
}

async function main() {
  record(
    "unit: free sempre footer",
    resolvePublicFooterBranding({ planHasBranding: true, hidePoweredBy: true }) === true,
    "ok",
  );
  record(
    "unit: Pro + ocultar → sem footer",
    resolvePublicFooterBranding({ planHasBranding: false, hidePoweredBy: true }) === false,
    "ok",
  );
  record(
    "unit: Pro + mostrar crédito → footer",
    resolvePublicFooterBranding({ planHasBranding: false, hidePoweredBy: false }) === true,
    "ok",
  );

  const stamp = Date.now().toString(36);
  const userId = randomUUID();
  const pageId = randomUUID();
  const email = `e2e-wl-${stamp}@clickora.test`;

  const freePlan = await prisma.plan.findFirst({
    where: { hasBranding: true },
    select: { id: true },
  });
  const proPlan = await prisma.plan.findFirst({
    where: { hasBranding: false },
    select: { id: true },
  });

  if (!proPlan || !freePlan) {
    record("planos free+Pro existem", false, `free=${!!freePlan} pro=${!!proPlan}`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.create({
    data: {
      id: userId,
      email,
      password: await bcrypt.hash("e2e-wl", 4),
      fullName: "E2E WhiteLabel",
      subscription: { create: { planId: proPlan.id, status: "active" } },
    },
  });

  try {
    await prisma.tenantBranding.create({
      data: {
        userId,
        brandName: "Acme WL",
        logoUrl: "https://cdn.example.com/logo.png",
        faviconUrl: "https://cdn.example.com/favicon.ico",
        primaryColor: "#0F172A",
        accentColor: "#2563EB",
        hidePoweredBy: true,
      },
    });

    await prisma.presellPage.create({
      data: {
        id: pageId,
        userId,
        title: "WL Test Page",
        slug: `wl-${stamp}`,
        type: "review",
        category: "test",
        language: "pt",
        status: "published",
        content: {
          title: "Produto",
          subtitle: "Sub",
          salesText: "Texto",
          ctaText: "Comprar",
          affiliateLink: "https://example.com/offer",
        },
        settings: {},
        tracking: {},
      },
    });

    let slice = await publicBrandingSlice(userId, pageId);
    record(
      "Pro + hidePoweredBy → footer_branding false",
      slice.footer_branding === false && slice.planHasBranding === false,
      `footer=${slice.footer_branding}`,
    );
    record(
      "tenant_branding completo na payload pública",
      slice.tenant_branding?.brand_name === "Acme WL" &&
        slice.tenant_branding.logo_url === "https://cdn.example.com/logo.png" &&
        slice.tenant_branding.favicon_url === "https://cdn.example.com/favicon.ico" &&
        slice.tenant_branding.primary_color === "#0F172A" &&
        slice.tenant_branding.accent_color === "#2563EB",
      JSON.stringify(slice.tenant_branding),
    );

    await prisma.tenantBranding.update({
      where: { userId },
      data: { hidePoweredBy: false },
    });
    slice = await publicBrandingSlice(userId, pageId);
    record(
      "Pro + hidePoweredBy=false → footer_branding true (toggle)",
      slice.footer_branding === true,
      `footer=${slice.footer_branding}`,
    );

    await prisma.subscription.update({
      where: { userId },
      data: { planId: freePlan.id },
    });
    slice = await publicBrandingSlice(userId, pageId);
    record(
      "plano free → footer_branding true",
      slice.footer_branding === true && slice.planHasBranding === true,
      `footer=${slice.footer_branding}`,
    );

    // Contrato FE (mesmas chaves que tenantBrandingPublic / PublicPresell)
    const feKeys = ["brand_name", "logo_url", "favicon_url", "primary_color", "accent_color"] as const;
    record(
      "contrato FE ↔ tenant_branding keys",
      !!slice.tenant_branding && feKeys.every((k) => k in slice.tenant_branding!),
      feKeys.join(","),
    );

    // Simular decisões FE
    const showCredit = slice.footer_branding === true;
    const hasChrome =
      !!slice.tenant_branding?.brand_name || !!slice.tenant_branding?.logo_url;
    record(
      "FE: free mostra crédito + chrome marca",
      showCredit && hasChrome,
      `credit=${showCredit} chrome=${hasChrome}`,
    );
  } finally {
    await prisma.presellPage.deleteMany({ where: { id: pageId } });
    await prisma.tenantBranding.deleteMany({ where: { userId } });
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

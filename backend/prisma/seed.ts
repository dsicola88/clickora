import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "../src/lib/prisma";
import { repairPlanSchemaColumns } from "../src/lib/schemaRepair";

const prisma = systemPrisma;

/** Mesmo SQL que migrations/repair — se migrate deploy falhar ou imagem antiga, o seed não rebenta com P2022. */
const USERS_INTEGRATION_COLUMNS_SQL = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sale_notify_email" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_refresh_token" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_customer_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_conversion_action_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_ads_login_customer_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_bot_token" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_notify_sale" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_notify_postback_error" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_notify_click" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_empty_user_agent" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "block_bot_clicks" BOOLEAN NOT NULL DEFAULT false`,
  /** Auto-blacklist por cliques/IP (migração 20260422120000) — alinha BD se `migrate deploy` ainda não correu. */
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auto_blacklist_click_threshold" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auto_blacklist_click_window_hours" INTEGER NOT NULL DEFAULT 24`,
  /** Meta CAPI (migração 20260417130000) — se `migrate deploy` não correu, o seed não falha com P2022. */
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_capi_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_pixel_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_access_token" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_capi_test_event_code" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_pixel_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_access_token" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tiktok_events_test_event_code" TEXT`,
] as const;

async function ensureUsersIntegrationColumns() {
  for (const sql of USERS_INTEGRATION_COLUMNS_SQL) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("[seed] ALTER users (ignorado, pode já existir):", e);
    }
  }
}

/**
 * Linhas curtas e honestas nos cartões — quotas reais do seed; sem prometer ROI.
 */
const PLAN_FEATURES_STARTER = [
  "Até 3 presell pages · 1.000 cliques/mês (trial)",
  "Tipos de presell no editor (dentro da quota) · Métricas no painel",
  "Tracking de cliques/impressões · Branding dclickora pode aparecer no rodapé",
  "Postback de afiliados: upgrade para Pro Mensal ou Pro Anual",
];

const PLAN_FEATURES_PRO = [
  "Até 25 presell pages · 50.000 cliques/mês",
  "Todos os tipos de presell no editor · Sem branding dclickora no rodapé",
  "Tracking com UTMs/GCLID · País e dispositivo · Postback BuyGoods/SmartAdv/Digistore",
  "Domínio personalizado: use Pro Anual (até 2) ou export HTML no Mensal",
];

const PLAN_FEATURES_PREMIUM = [
  "Presells e cliques com quotas amplas (uso razoável) durante o ano",
  "Até 2 domínios personalizados · Sem branding dclickora no rodapé",
  "Postback de afiliados + mesmas ferramentas de tracking do Pro Mensal",
  "Módulo de anúncios (Google/Meta/TikTok) com revisão humana — quando activo no plano",
];

function jsonFeatures(lines: string[]) {
  return JSON.parse(JSON.stringify(lines)) as Prisma.InputJsonValue;
}

async function upsertUserWithRoleAndPlan(args: {
  email: string;
  passwordPlain: string;
  fullName: string;
  role: "super_admin" | "admin" | "moderator" | "user";
  planId: string;
}) {
  const password = await bcrypt.hash(args.passwordPlain, 12);
  /** `select` evita RETURNING * — sem isto, P2022 se colunas novas (ex. google_ads_*) ainda não existirem na BD. */
  const user = await prisma.user.upsert({
    where: { email: args.email },
    update: {
      password,
      fullName: args.fullName,
    },
    create: {
      email: args.email,
      password,
      fullName: args.fullName,
    },
    select: { id: true, email: true, fullName: true },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: { userId: user.id, role: args.role },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      planId: args.planId,
      status: "active",
    },
    update: {
      planId: args.planId,
      status: "active",
    },
  });

  return user;
}

async function main() {
  console.log("🌱 Seeding database...");
  await ensureUsersIntegrationColumns();
  await repairPlanSchemaColumns();

  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: "plan_free" },
      update: {
        name: "Starter",
        maxCustomDomains: 0,
        affiliateWebhookEnabled: false,
        dpilotAdsEnabled: false,
        features: jsonFeatures(PLAN_FEATURES_STARTER),
      },
      create: {
        id: "plan_free",
        name: "Starter",
        type: "free_trial",
        priceCents: 0,
        maxPresellPages: 3,
        maxClicksPerMonth: 1000,
        maxCustomDomains: 0,
        hasBranding: true,
        affiliateWebhookEnabled: false,
        dpilotAdsEnabled: false,
        features: jsonFeatures(PLAN_FEATURES_STARTER),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_monthly" },
      update: {
        name: "Pro Mensal",
        priceCents: 2400,
        maxCustomDomains: 1,
        maxClicksPerMonth: 150000,
        affiliateWebhookEnabled: true,
        dpilotAdsEnabled: false,
        features: jsonFeatures(PLAN_FEATURES_PRO),
      },
      create: {
        id: "plan_monthly",
        name: "Pro Mensal",
        type: "monthly",
        priceCents: 2400,
        maxPresellPages: 25,
        maxClicksPerMonth: 150000,
        maxCustomDomains: 1,
        hasBranding: false,
        affiliateWebhookEnabled: true,
        dpilotAdsEnabled: false,
        features: jsonFeatures(PLAN_FEATURES_PRO),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_annual" },
      update: {
        name: "Pro Anual",
        priceCents: 19600,
        maxCustomDomains: 2,
        affiliateWebhookEnabled: true,
        dpilotAdsEnabled: true,
        features: jsonFeatures(PLAN_FEATURES_PREMIUM),
      },
      create: {
        id: "plan_annual",
        name: "Pro Anual",
        type: "annual",
        priceCents: 19600,
        maxPresellPages: null,
        maxClicksPerMonth: null,
        maxCustomDomains: 2,
        hasBranding: false,
        affiliateWebhookEnabled: true,
        dpilotAdsEnabled: true,
        features: jsonFeatures(PLAN_FEATURES_PREMIUM),
      },
    }),
  ]);

  const migrated = await prisma.subscription.updateMany({
    where: { planId: "plan_quarterly" },
    data: { planId: "plan_monthly" },
  });
  if (migrated.count > 0) {
    console.log(`ℹ️ ${migrated.count} assinatura(s) migradas de trimestral → Pro.`);
  }
  await prisma.plan.deleteMany({ where: { id: "plan_quarterly" } });

  try {
    await prisma.plansLandingConfig.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        heroTitle: "Escolha seu plano",
        heroSubtitle:
          "Limites de presells e cliques estão em cada cartão. Starter para testar; Pro Mensal e Pro Anual com quotas maiores e mais domínios no anual — alinhados com a Hotmart.",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "";
    console.warn(
      `⚠️ Seed plans_landing_config ignorado (${code || "erro"}): ${msg}. Continua com planos/utilizadores — confirma \`prisma migrate deploy\` na Railway.`,
    );
  }

  const planMonthly = plans.find((p) => p.id === "plan_monthly")!;
  const planAnnual = plans.find((p) => p.id === "plan_annual")!;

  /** Mesma password para as contas de seed legadas. */
  const seedPassword = "Dpa211088@";

  await upsertUserWithRoleAndPlan({
    email: "danielclickora@gmail.com",
    passwordPlain: seedPassword,
    fullName: "Daniel Super Admin",
    role: "super_admin",
    planId: planMonthly.id,
  });

  await upsertUserWithRoleAndPlan({
    email: "danielclickora1@gmail.com",
    passwordPlain: seedPassword,
    fullName: "Daniel Cliente",
    role: "user",
    planId: planMonthly.id,
  });

  await upsertUserWithRoleAndPlan({
    email: "danielclickora2@gmail.com",
    passwordPlain: seedPassword,
    fullName: "Daniel Admin",
    role: "admin",
    planId: planMonthly.id,
  });

  /** Gerenciador da app (superadmin) — email/password pedidos para operação. */
  await upsertUserWithRoleAndPlan({
    email: "dclickora2026@gmail.com",
    passwordPlain: "Datoda@",
    fullName: "dclickora Gerenciador",
    role: "super_admin",
    planId: planAnnual.id,
  });

  console.log(`✅ Plans: ${plans.map((p) => p.name).join(", ")}`);
  console.log("✅ super_admin (Pro): danielclickora@gmail.com");
  console.log("✅ user / cliente normal (Pro): danielclickora1@gmail.com");
  console.log("✅ admin (Pro): danielclickora2@gmail.com");
  console.log("✅ super_admin gerenciador (Pro Anual): dclickora2026@gmail.com");
  console.log("🌱 Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

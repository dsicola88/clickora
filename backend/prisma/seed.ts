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
  /** Meta CAPI (migração 20260417130000) — se `migrate deploy` não correu, o seed não falha com P2022. */
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_capi_enabled" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_pixel_id" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_access_token" TEXT`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "meta_capi_test_event_code" TEXT`,
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
 * Funcionalidades de tracking e proteção (iguais na filosofia do produto; quotas no topo de cada plano).
 */
const PLATFORM_FEATURE_LINES = [
  "Conversões automáticas e registo manual de conversões",
  "Geolocalização por IP (país/região, base GeoLite)",
  "GCLID em URLs e ligação a conversões Google Ads quando configurado",
  "ClickShield no iframe de vídeo presell (YouTube)",
  "Limite de pedidos de tracking por IP no servidor (anti-spam)",
  "Anti-bots: análise de User-Agent; bloqueio opcional na conta",
  "Bloqueio opcional de pedidos sem User-Agent",
  "Blacklist e whitelist de IPv4 (bloqueio ou modo só permitidos)",
  "Classificação de bot nos eventos; melhorias de rede em roadmap",
] as const;

const PLAN_FEATURES_STARTER = [
  "Até 3 presell pages · 1.000 cliques/mês (trial)",
  "As linhas abaixo aplicam-se dentro destas quotas",
  ...PLATFORM_FEATURE_LINES,
  "Tipos de presell disponíveis no editor (com limites do plano) · Métricas no painel · Branding Clickora pode aparecer no rodapé",
];

const PLAN_FEATURES_PRO = [
  "Até 25 presell pages · 50.000 cliques/mês",
  "Mesmas ferramentas abaixo durante a subscrição mensal (sujeito a quotas)",
  ...PLATFORM_FEATURE_LINES,
  "Todos os tipos de presell expostos no editor (VSL, TSL, DTC, gates, etc.) · Eventos e relatórios no painel · Sem branding Clickora no rodapé",
];

const PLAN_FEATURES_PREMIUM = [
  "Presells e cliques ilimitados na conta durante o período do plano anual (uso razoável)",
  ...PLATFORM_FEATURE_LINES,
  "Até 2 domínios personalizados · Sem branding Clickora no rodapé",
  "Webhooks e endpoints no servidor para tracking, presell e integrações",
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
        features: jsonFeatures(PLAN_FEATURES_STARTER),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_monthly" },
      update: {
        name: "Pro",
        priceCents: 2400,
        maxCustomDomains: 0,
        features: jsonFeatures(PLAN_FEATURES_PRO),
      },
      create: {
        id: "plan_monthly",
        name: "Pro",
        type: "monthly",
        priceCents: 2400,
        maxPresellPages: 25,
        maxClicksPerMonth: 50000,
        maxCustomDomains: 0,
        hasBranding: false,
        features: jsonFeatures(PLAN_FEATURES_PRO),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_annual" },
      update: {
        name: "Premium",
        priceCents: 19600,
        maxCustomDomains: 2,
        features: jsonFeatures(PLAN_FEATURES_PREMIUM),
      },
      create: {
        id: "plan_annual",
        name: "Premium",
        type: "annual",
        priceCents: 19600,
        maxPresellPages: null,
        maxClicksPerMonth: null,
        maxCustomDomains: 2,
        hasBranding: false,
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
          "Limites de presells e cliques estão em cada cartão. Starter para testar, Pro e Premium com quotas maiores e mais domínios no plano anual — conforme configurado.",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "";
    console.warn(
      `⚠️ Seed plans_landing_config ignorado (${code || "erro"}): ${msg}. Continua com planos/utilizadores — confirma \`prisma migrate deploy\` na Railway.`,
    );
  }

  const planAnnual = plans.find((p) => p.id === "plan_annual")!;

  /** Mesma password para as contas de seed (também em produção no Docker). Todas com Premium (anual) para testes sem limites de presell/cliques. */
  const seedPassword = "Dpa211088@";

  await upsertUserWithRoleAndPlan({
    email: "danielclickora@gmail.com",
    passwordPlain: seedPassword,
    fullName: "Daniel Super Admin",
    role: "super_admin",
    planId: planAnnual.id,
  });

  await upsertUserWithRoleAndPlan({
    email: "danielclickora1@gmail.com",
    passwordPlain: seedPassword,
    fullName: "Daniel Assinante",
    role: "user",
    planId: planAnnual.id,
  });

  await upsertUserWithRoleAndPlan({
    email: "danielclickora2@gmail.com",
    passwordPlain: seedPassword,
    fullName: "Daniel Admin",
    role: "admin",
    planId: planAnnual.id,
  });

  console.log(`✅ Plans: ${plans.map((p) => p.name).join(", ")}`);
  console.log("✅ super_admin (Premium): danielclickora@gmail.com");
  console.log("✅ user (Premium): danielclickora1@gmail.com");
  console.log("✅ admin (Premium): danielclickora2@gmail.com");
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

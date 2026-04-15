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
      update: { maxCustomDomains: 0 },
      create: {
        id: "plan_free",
        name: "Free Trial",
        type: "free_trial",
        priceCents: 0,
        maxPresellPages: 3,
        maxClicksPerMonth: 1000,
        maxCustomDomains: 0,
        hasBranding: true,
        features: JSON.parse(JSON.stringify([
          "Até 3 presell pages",
          "1.000 cliques/mês",
          "Templates básicos",
          "Analytics básico",
          "Branding dclickora",
        ])),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_monthly" },
      update: { name: "Pro Mensal", priceCents: 7990, maxCustomDomains: 0 },
      create: {
        id: "plan_monthly",
        name: "Pro Mensal",
        type: "monthly",
        priceCents: 7990,
        maxPresellPages: 25,
        maxClicksPerMonth: 50000,
        maxCustomDomains: 0,
        hasBranding: false,
        features: JSON.parse(JSON.stringify([
          "Até 25 presell pages",
          "50.000 cliques/mês",
          "Todos os templates",
          "Analytics completo",
          "Sem branding",
          "Suporte prioritário",
        ])),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_annual" },
      update: { name: "Pro Anual", priceCents: 69700, maxCustomDomains: 2 },
      create: {
        id: "plan_annual",
        name: "Pro Anual",
        type: "annual",
        priceCents: 69700,
        maxPresellPages: null,
        maxClicksPerMonth: null,
        maxCustomDomains: 2,
        hasBranding: false,
        features: JSON.parse(JSON.stringify([
          "Presell pages ilimitadas",
          "Cliques ilimitados",
          "Todos os templates",
          "Analytics avançado",
          "Sem branding",
          "Suporte VIP",
          "API access",
        ])),
      },
    }),
  ]);

  const migrated = await prisma.subscription.updateMany({
    where: { planId: "plan_quarterly" },
    data: { planId: "plan_monthly" },
  });
  if (migrated.count > 0) {
    console.log(`ℹ️ ${migrated.count} assinatura(s) migradas de trimestral → Pro Mensal.`);
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
          "Cada cartão mostra os limites de presells e de cliques por mês; abaixo, o que mais está incluído. Comece grátis e faça upgrade quando precisar.",
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

  /** Mesma password para as contas de seed (também em produção no Docker). Todas com Pro Anual para testes sem limites de presell/cliques. */
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
  console.log("✅ super_admin (Pro Anual): danielclickora@gmail.com");
  console.log("✅ user (Pro Anual): danielclickora1@gmail.com");
  console.log("✅ admin (Pro Anual): danielclickora2@gmail.com");
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

import bcrypt from "bcryptjs";
import { systemPrisma } from "../src/lib/prisma";

const prisma = systemPrisma;

async function upsertUserWithRoleAndPlan(args: {
  email: string;
  passwordPlain: string;
  fullName: string;
  role: "super_admin" | "admin" | "moderator" | "user";
  planId: string;
}) {
  const password = await bcrypt.hash(args.passwordPlain, 12);
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

  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: "plan_free" },
      update: {},
      create: {
        id: "plan_free",
        name: "Free Trial",
        type: "free_trial",
        priceCents: 0,
        maxPresellPages: 3,
        maxClicksPerMonth: 1000,
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
      update: { name: "Pro Mensal" },
      create: {
        id: "plan_monthly",
        name: "Pro Mensal",
        type: "monthly",
        priceCents: 4700,
        maxPresellPages: 25,
        maxClicksPerMonth: 50000,
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
      where: { id: "plan_quarterly" },
      update: {},
      create: {
        id: "plan_quarterly",
        name: "Trimestral",
        type: "quarterly",
        priceCents: 11700,
        maxPresellPages: 100,
        maxClicksPerMonth: 200000,
        hasBranding: false,
        features: JSON.parse(JSON.stringify([
          "Até 100 presell pages",
          "200.000 cliques/mês",
          "Todos os templates",
          "Analytics avançado",
          "Sem branding",
          "Suporte prioritário",
          "API access",
        ])),
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan_annual" },
      update: { name: "Pro Anual" },
      create: {
        id: "plan_annual",
        name: "Pro Anual",
        type: "annual",
        priceCents: 39700,
        maxPresellPages: null,
        maxClicksPerMonth: null,
        hasBranding: false,
        features: JSON.parse(JSON.stringify([
          "Presell pages ilimitadas",
          "Cliques ilimitados",
          "Todos os templates",
          "Analytics avançado",
          "Sem branding",
          "Suporte VIP",
          "API access",
          "White label",
        ])),
      },
    }),
  ]);

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

  const planMonthly = plans.find((p) => p.id === "plan_monthly")!;
  const planAnnual = plans.find((p) => p.id === "plan_annual")!;

  await upsertUserWithRoleAndPlan({
    email: "dclickora@gmail.com",
    passwordPlain: "Dpa211088",
    fullName: "Super Admin",
    role: "super_admin",
    planId: planAnnual.id,
  });

  await upsertUserWithRoleAndPlan({
    email: "adminpro@dclickora.com",
    passwordPlain: "pro123456",
    fullName: "Admin Pro (teste)",
    role: "admin",
    planId: planMonthly.id,
  });

  await upsertUserWithRoleAndPlan({
    email: "admin@dclickora.com",
    passwordPlain: "admin123456",
    fullName: "Admin dclickora",
    role: "admin",
    planId: planAnnual.id,
  });

  /** Utilizador normal (role `user`) para testar a app como assinante. */
  await upsertUserWithRoleAndPlan({
    email: "daniel@gmail.com",
    passwordPlain: "daniel123456",
    fullName: "daniel para testes",
    role: "user",
    planId: planMonthly.id,
  });

  console.log(`✅ Plans: ${plans.map((p) => p.name).join(", ")}`);
  console.log("✅ Super Admin: dclickora@gmail.com  |  senha: (definida no seed)");
  console.log("✅ Admin + Pro (mensal): adminpro@dclickora.com  |  senha: pro123456");
  console.log("✅ Admin + Pro (anual): admin@dclickora.com  |  senha: admin123456");
  console.log("✅ Utilizador normal: daniel@gmail.com  |  senha: daniel123456  |  plano: Pro Mensal");
  console.log("🌱 Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

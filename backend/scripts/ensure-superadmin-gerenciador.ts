/**
 * Upsert do superadmin gerenciador (dclickora2026@gmail.com).
 * Uso local: `cd backend && npx tsx scripts/ensure-superadmin-gerenciador.ts`
 * Produção (host interno não alcançável fora da Railway):
 *   `DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/ensure-superadmin-gerenciador.ts`
 *   (com as variáveis do serviço clickora / Postgres)
 */
import bcrypt from "bcryptjs";
import { systemPrisma } from "../src/lib/prisma";

const EMAIL = "dclickora2026@gmail.com";
const PASSWORD = "Datoda@";
const FULL_NAME = "dclickora Gerenciador";

async function main() {
  const plan =
    (await systemPrisma.plan.findUnique({ where: { id: "plan_annual" } })) ??
    (await systemPrisma.plan.findFirst({ where: { type: "annual" } })) ??
    (await systemPrisma.plan.findFirst({ orderBy: { priceCents: "desc" } }));

  if (!plan) {
    throw new Error("Nenhum plano na BD — corre prisma db seed primeiro.");
  }

  const password = await bcrypt.hash(PASSWORD, 12);
  const user = await systemPrisma.user.upsert({
    where: { email: EMAIL },
    update: { password, fullName: FULL_NAME },
    create: { email: EMAIL, password, fullName: FULL_NAME },
    select: { id: true, email: true },
  });

  await systemPrisma.userRole.deleteMany({ where: { userId: user.id } });
  await systemPrisma.userRole.create({
    data: { userId: user.id, role: "super_admin" },
  });

  await systemPrisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, planId: plan.id, status: "active" },
    update: { planId: plan.id, status: "active" },
  });

  console.log(`OK super_admin ${user.email} · plano ${plan.name} (${plan.id})`);
}

main()
  .then(async () => {
    await systemPrisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await systemPrisma.$disconnect();
    process.exit(1);
  });

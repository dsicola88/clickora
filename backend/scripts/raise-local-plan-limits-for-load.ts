/**
 * Apenas BD local de teste: sobe maxPresellPages para permitir bursts de carga.
 * NÃO usar em produção.
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations } from "./lib/loadTestSafety";

const prisma = new PrismaClient();

async function main() {
  assertLocalDatabaseForMutations();
  const updated = await prisma.plan.updateMany({
    where: { id: { in: ["plan_monthly", "plan_annual"] } },
    data: { maxPresellPages: 50_000, maxClicksPerMonth: 5_000_000 },
  });
  console.log(JSON.stringify({ updated: updated.count, maxPresellPages: 50_000 }));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

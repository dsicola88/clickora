/**
 * Reescreve braços de rotador com destino localhost:/p|/l para o domínio
 * verificado da conta (ou FRONTEND_URL). Seguro para correr em produção.
 *
 *   cd backend && npx tsx scripts/repair-rotator-localhost-arms.ts
 */
import { systemPrisma } from "../src/lib/prisma";
import { rewriteLocalPresellDestination } from "../src/lib/rewriteLocalPresellDestination";

async function preferredOrigin(userId: string, contextPresellId: string): Promise<string | null> {
  const page = await systemPrisma.presellPage.findFirst({
    where: { id: contextPresellId, userId },
    select: { customDomain: { select: { hostname: true, status: true } } },
  });
  if (page?.customDomain?.status === "verified" && page.customDomain.hostname) {
    return `https://${page.customDomain.hostname}`;
  }
  const fallback = await systemPrisma.customDomain.findFirst({
    where: { userId, status: "verified", NOT: { purpose: "tracking" } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { hostname: true },
  });
  return fallback?.hostname ? `https://${fallback.hostname}` : null;
}

async function main() {
  const arms = await systemPrisma.trafficRotatorArm.findMany({
    where: {
      OR: [
        { destinationUrl: { contains: "://localhost" } },
        { destinationUrl: { contains: "://127.0.0.1" } },
      ],
    },
    include: {
      rotator: { select: { id: true, userId: true, contextPresellId: true, slug: true } },
    },
  });

  console.log(`Braços com localhost: ${arms.length}`);
  let fixed = 0;
  let skipped = 0;

  for (const arm of arms) {
    const origin = await preferredOrigin(arm.rotator.userId, arm.rotator.contextPresellId);
    const next = rewriteLocalPresellDestination(arm.destinationUrl, origin);
    if (next === arm.destinationUrl || /localhost|127\.0\.0\.1/i.test(next)) {
      console.warn(`SKIP ${arm.id} (${arm.rotator.slug}) — sem origem pública`, arm.destinationUrl);
      skipped += 1;
      continue;
    }
    await systemPrisma.trafficRotatorArm.update({
      where: { id: arm.id },
      data: { destinationUrl: next },
    });
    console.log(`OK ${arm.rotator.slug}: ${arm.destinationUrl} → ${next}`);
    fixed += 1;
  }

  console.log(`Reparados: ${fixed}; ignorados: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });

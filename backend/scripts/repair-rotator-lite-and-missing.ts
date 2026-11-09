/**
 * 1) Braços /l/ → /p/ (SPA) enquanto o HTML lite não está no Railway.
 * 2) Braços com página em falta: desactiva o braço (weight=0) e regista.
 *
 *   cd backend && npx tsx scripts/repair-rotator-lite-and-missing.ts
 */
import { systemPrisma } from "../src/lib/prisma";

async function main() {
  const arms = await systemPrisma.trafficRotatorArm.findMany({
    include: {
      rotator: { select: { id: true, slug: true, isActive: true } },
    },
  });

  let toP = 0;
  let missing = 0;
  let ok = 0;

  for (const arm of arms) {
    const m = String(arm.destinationUrl || "").match(/^(https?:\/\/[^/]+)\/([pl])\/([0-9a-f-]{36})(.*)$/i);
    if (!m) {
      ok += 1;
      continue;
    }
    const [, origin, kind, id, rest] = m;
    const page = await systemPrisma.presellPage.findUnique({
      where: { id },
      select: { id: true, type: true, status: true, title: true },
    });

    if (!page) {
      console.warn(
        `MISSING ${arm.rotator.slug} ${arm.label}: ${arm.destinationUrl} — weight→0`,
      );
      await systemPrisma.trafficRotatorArm.update({
        where: { id: arm.id },
        data: { weight: 0 },
      });
      missing += 1;
      continue;
    }

    if (kind.toLowerCase() === "l") {
      const next = `${origin}/p/${id}${rest || ""}`;
      await systemPrisma.trafficRotatorArm.update({
        where: { id: arm.id },
        data: { destinationUrl: next },
      });
      console.log(`L→P ${arm.rotator.slug} ${arm.label}: ${arm.destinationUrl} → ${next}`);
      toP += 1;
      continue;
    }

    ok += 1;
  }

  console.log(`Feito: /l→/p=${toP}; missing(weight0)=${missing}; intactos≈${ok}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });

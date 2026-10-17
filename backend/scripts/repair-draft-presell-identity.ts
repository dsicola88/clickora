/**
 * Repara presells em rascunho/pausa sem contacto (CT-002) e tenta publicar de novo.
 *
 *   DATABASE_URL=... npx tsx scripts/repair-draft-presell-identity.ts
 *   DRY_RUN=1 — só listar, sem gravar
 */
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../src/lib/prisma";
import { enrichPresellPageRecords } from "../src/lib/presellOperatorIdentity";
import { assertPublishAllowed } from "../src/compliance/service";

const DRY = process.env.DRY_RUN === "1";

async function main() {
  const pages = await prisma.presellPage.findMany({
    where: { status: { in: ["draft", "paused"] } },
    select: {
      id: true,
      title: true,
      status: true,
      userId: true,
      content: true,
      settings: true,
      slug: true,
      type: true,
      language: true,
      category: true,
      videoUrl: true,
      complianceGate: true,
      contentFingerprint: true,
    },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });

  let enriched = 0;
  let published = 0;
  let stillBlocked = 0;

  for (const page of pages) {
    const user = await prisma.user.findUnique({
      where: { id: page.userId },
      select: { email: true, fullName: true, saleNotifyEmail: true },
    });
    if (!user) continue;

    const { content, settings, changed } = enrichPresellPageRecords({
      content: page.content,
      settings: page.settings,
      user,
    });
    if (!changed) continue;

    enriched += 1;
    console.log(`[enrich] ${page.id.slice(0, 8)} · ${page.title} (${page.status})`);

    if (DRY) continue;

    const updated = await systemPrisma.presellPage.update({
      where: { id: page.id },
      data: {
        settings: settings as Prisma.InputJsonValue,
        content: content as Prisma.InputJsonValue,
        complianceGate: "unchecked",
        contentFingerprint: null,
      },
    });

    const gate = await assertPublishAllowed({ page: updated, runIfStale: true });
    if (gate.ok) {
      await systemPrisma.presellPage.update({
        where: { id: page.id },
        data: { status: "published" },
      });
      published += 1;
      console.log(`  → published`);
    } else {
      stillBlocked += 1;
      const crit = (gate.body.critical_issues as unknown[]) || [];
      console.log(`  → still blocked (${crit.length} issues)`);
    }
  }

  console.log(
    `\nDone. scanned=${pages.length} enriched=${enriched} published=${published} blocked=${stillBlocked} dry=${DRY}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

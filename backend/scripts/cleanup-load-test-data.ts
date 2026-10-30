import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations } from "./lib/loadTestSafety";

const prisma = new PrismaClient();

async function main() {
  assertLocalDatabaseForMutations();
  for (const email of ["danielclickora1@gmail.com", "danielclickora2@gmail.com"]) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        subscription: { select: { plan: { select: { maxPresellPages: true, name: true } } } },
      },
    });
    if (!u) {
      console.log(JSON.stringify({ email, missing: true }));
      continue;
    }
    const before = await prisma.presellPage.count({ where: { userId: u.id } });
    const del = await prisma.presellPage.deleteMany({
      where: {
        userId: u.id,
        OR: [
          { slug: { startsWith: "load-" } },
          { slug: { startsWith: "burst-" } },
          { slug: { startsWith: "iso-" } },
          { slug: { startsWith: "audit-" } },
        ],
      },
    });
    const after = await prisma.presellPage.count({ where: { userId: u.id } });
    console.log(
      JSON.stringify({
        email,
        before,
        deleted: del.count,
        after,
        max: u.subscription?.plan?.maxPresellPages,
        plan: u.subscription?.plan?.name,
      }),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

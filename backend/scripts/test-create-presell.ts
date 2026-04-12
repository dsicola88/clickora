/**
 * Teste manual: cria uma presell para um utilizador existente (DB local ou remoto via DATABASE_URL).
 * Uso: npx tsx scripts/test-create-presell.ts
 * Opcional: TEST_PRESSELL_EMAIL=email@exemplo.com
 */
import "dotenv/config";
import { systemPrisma } from "../src/lib/prisma";

const email = process.env.TEST_PRESSELL_EMAIL?.trim() || "danielclickora1@gmail.com";

async function main() {
  const user = await systemPrisma.user.findUnique({
    where: { email },
    include: { subscription: { include: { plan: true } } },
  });
  if (!user) {
    console.error(`Utilizador não encontrado: ${email}. Corre prisma db seed ou usa TEST_PRESSELL_EMAIL.`);
    process.exit(1);
  }

  const slug = `test-${Date.now()}`;
  const page = await systemPrisma.presellPage.create({
    data: {
      userId: user.id,
      title: "Presell teste (script)",
      slug,
      type: "cookies",
      category: "sem",
      language: "pt",
      content: { note: "criada por scripts/test-create-presell.ts" },
      settings: {},
      tracking: {},
      status: "draft",
    },
  });

  console.log("OK — presell criada:");
  console.log(JSON.stringify({ id: page.id, slug: page.slug, title: page.title, userId: page.userId }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });

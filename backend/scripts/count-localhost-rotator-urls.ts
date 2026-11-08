import { systemPrisma } from "../src/lib/prisma";

async function main() {
  const localhost_arms = await systemPrisma.trafficRotatorArm.count({
    where: {
      OR: [
        { destinationUrl: { contains: "://localhost" } },
        { destinationUrl: { contains: "://127.0.0.1" } },
      ],
    },
  });
  const localhost_backup = await systemPrisma.trafficRotator.count({
    where: {
      OR: [
        { backupUrl: { contains: "://localhost" } },
        { backupUrl: { contains: "://127.0.0.1" } },
      ],
    },
  });
  console.log(JSON.stringify({ localhost_arms, localhost_backup }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";
import { databaseHostInfo } from "./lib/loadTestSafety";

async function main() {
  const info = databaseHostInfo();
  console.log(JSON.stringify({ database: info }));
  const p = new PrismaClient();
  try {
    const r = await p.$queryRaw<Array<{ db: string; usr: string }>>`
      SELECT current_database() as db, current_user as usr
    `;
    console.log(JSON.stringify({ connected: r[0] }));
    const users = await p.user.count();
    console.log(JSON.stringify({ users }));
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Smoke: sticky session no /track/rot — cookie força o braço (weighted).
 * Uso: set -a; source .env.audit-fase-b; set +a; npx tsx scripts/smoke-sticky-rotator.ts
 */
import { PrismaClient } from "@prisma/client";
import { stickyRotatorCookieName } from "../src/lib/trafficRotator.service";

const BASE = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3011").replace(/\/$/, "");

async function main() {
  const p = new PrismaClient();
  const rot = await p.trafficRotator.findFirst({
    where: { isActive: true },
    include: { arms: { orderBy: { orderIndex: "asc" } }, contextPresell: { select: { status: true } } },
  });
  if (!rot || rot.contextPresell.status !== "published" || rot.arms.length < 2) {
    console.log(JSON.stringify({ stickySmoke: "skip", reason: "no published rotator with 2+ arms" }));
    await p.$disconnect();
    return;
  }

  await p.trafficRotator.update({
    where: { id: rot.id },
    data: { stickySession: true, mode: "weighted" },
  });

  const armB = rot.arms[1]!;
  const cookie = stickyRotatorCookieName(rot.id);
  const url = `${BASE}/api/track/rot/${rot.id}`;
  const r1 = await fetch(url, {
    redirect: "manual",
    headers: { Cookie: `${cookie}=${armB.id}` },
  });
  const loc = r1.headers.get("location") || "";
  const setc = typeof r1.headers.getSetCookie === "function" ? r1.headers.getSetCookie() : [];
  let destHost = "";
  try {
    destHost = new URL(armB.destinationUrl).hostname;
  } catch {
    /* ignore */
  }
  const stickyHit =
    r1.status >= 300 &&
    r1.status < 400 &&
    (Boolean(destHost && loc.includes(destHost)) || loc.includes(armB.destinationUrl.slice(0, 48)));

  console.log(
    JSON.stringify(
      {
        stickySmoke: stickyHit ? "ok" : "fail",
        status: r1.status,
        loc: loc.slice(0, 180),
        setCookieHasSticky: setc.some((c) => c.startsWith(`${cookie}=`)),
        expectedArm: armB.id,
        destHost,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
  if (!stickyHit) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

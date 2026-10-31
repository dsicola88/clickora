/**
 * Smoke HTTP sticky: cria rotador weighted + sticky, 1.º hit escolhe braço, 2.º com cookie repete.
 *
 *   set -a; source .env.audit-fase-b; set +a
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/smoke-sticky-rotator.ts
 */
import { PrismaClient } from "@prisma/client";
import { stickyRotatorCookieName } from "../src/lib/trafficRotator.service";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3011").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";

async function main() {
  assertSafeHttpTarget(BASE);
  assertLocalDatabaseForMutations(process.env.DATABASE_URL || "");

  const p = new PrismaClient();
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  const { token, user } = (await login.json()) as { token: string; user: { id: string } };

  let presell = await p.presellPage.findFirst({
    where: { userId: user.id, status: "published" },
    select: { id: true },
  });
  if (!presell) {
    const created = await fetch(`${BASE}/api/presells`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: `Sticky smoke ${Date.now().toString(36)}`,
        slug: `sticky-sm-${Date.now().toString(36)}`,
        status: "published",
        type: "cookies",
        content: { html: "<p>ok</p>" },
        settings: {},
      }),
    });
    if (!created.ok) throw new Error(`presell create ${created.status} ${await created.text()}`);
    const pj = (await created.json()) as { id: string };
    presell = { id: pj.id };
  }

  const stamp = Date.now().toString(36);
  const create = await fetch(`${BASE}/api/traffic-rotators`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: `Sticky ${stamp}`,
      slug: `sticky-${stamp}`,
      mode: "weighted",
      sticky_session: true,
      context_presell_id: presell.id,
      is_active: true,
      arms: [
        { destination_url: "https://offer-a.example/path-a", label: "A", order_index: 0, weight: 90 },
        { destination_url: "https://offer-b.example/path-b", label: "B", order_index: 1, weight: 10 },
      ],
    }),
  });
  if (!create.ok) throw new Error(`rotator create ${create.status} ${await create.text()}`);
  const rot = (await create.json()) as { id: string; arms: { id: string; destination_url: string }[] };
  const cookieName = stickyRotatorCookieName(rot.id);
  const url = `${BASE}/api/track/rot/${rot.id}`;

  const r1 = await fetch(url, { redirect: "manual" });
  const loc1 = r1.headers.get("location") || "";
  const set1 = typeof r1.headers.getSetCookie === "function" ? r1.headers.getSetCookie() : [];
  const setCookie = set1.find((c) => c.startsWith(`${cookieName}=`)) || "";
  const armFromCookie = decodeURIComponent((setCookie.split(";")[0] || "").split("=")[1] || "");
  const armB = rot.arms.find((a) => a.destination_url.includes("path-b"))!;

  const r2 = await fetch(url, {
    redirect: "manual",
    headers: { Cookie: `${cookieName}=${armB.id}` },
  });
  const loc2 = r2.headers.get("location") || "";
  const stickyHit = r2.status >= 300 && r2.status < 400 && loc2.includes("path-b");

  console.log(
    JSON.stringify(
      {
        stickySmoke: stickyHit ? "ok" : "fail",
        firstStatus: r1.status,
        firstLoc: loc1.slice(0, 100),
        setCookieArm: armFromCookie.slice(0, 8),
        secondStatus: r2.status,
        secondLoc: loc2.slice(0, 120),
        forcedArmB: armB.id.slice(0, 8),
      },
      null,
      2,
    ),
  );

  await p.trafficRotator.deleteMany({ where: { id: rot.id } }).catch(() => undefined);
  await p.$disconnect();
  if (!stickyHit) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

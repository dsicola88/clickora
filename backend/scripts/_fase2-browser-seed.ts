import { stickyRotatorCookieName } from "../src/lib/trafficRotator.service";
import { systemPrisma } from "../src/lib/prisma";

async function main() {
  const BASE = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3012").replace(/\/$/, "");
  const stamp = Date.now().toString(36);
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `br-${stamp}@audit.clickora.test`,
      password: "Browser1!",
      full_name: "Browser",
      accept_policies: true,
    }),
  });
  const rj = (await reg.json()) as { token?: string; user?: { id: string } };
  const token = rj.token!;
  const p = await fetch(`${BASE}/api/presells`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: "br",
      slug: `br-${stamp}`,
      type: "review",
      status: "draft",
      content: { title: "b" },
    }),
  });
  const pj = (await p.json()) as { id: string };
  await systemPrisma.presellPage.update({ where: { id: pj.id }, data: { status: "published" } });
  const r = await fetch(`${BASE}/api/traffic-rotators`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "br",
      slug: `br-rot-${stamp}`,
      mode: "weighted",
      sticky_session: true,
      context_presell_id: pj.id,
      is_active: true,
      arms: [
        { destination_url: "https://example.com/browser-a", label: "A", order_index: 0, weight: 50 },
        { destination_url: "https://example.com/browser-b", label: "B", order_index: 1, weight: 50 },
      ],
    }),
  });
  const rot = (await r.json()) as { id: string };
  console.log(
    JSON.stringify({
      url: `${BASE}/api/track/rot/${rot.id}`,
      cookie: stickyRotatorCookieName(rot.id),
      rotatorId: rot.id,
      userId: rj.user?.id,
      presellId: pj.id,
    }),
  );
  await systemPrisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

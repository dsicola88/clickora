/**
 * Testes de integração: raiz do domínio (root presell) + isolamento multi-tenant.
 * Não arranca o servidor HTTP — usa systemPrisma e replica a lógica de resolução de GET /api/public/.../root-presell.
 *
 * Uso: `npm run test:presell-multitenant` (na pasta backend)
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { evaluateSubscriptionAccess } from "../src/lib/subscription";
import { systemPrisma } from "../src/lib/prisma";

const EMAIL_A = "mt-presell-flow-a@dclickora.local";
const EMAIL_B = "mt-presell-flow-b@dclickora.local";

/** Espelha a escolha de página em presellController.getRootPresellForHost (após obter cd + ownerId). */
async function resolveRootPresellPageId(
  cd: { id: string; rootPresellId: string | null },
  ownerId: string,
): Promise<string | null> {
  let page = null as
    | Prisma.PresellPageGetPayload<{ include: { user: { include: { subscription: true } } } }>
    | null;

  if (cd.rootPresellId) {
    const byRoot = await systemPrisma.presellPage.findFirst({
      where: {
        id: cd.rootPresellId,
        userId: ownerId,
        customDomainId: cd.id,
        status: "published",
      },
      include: { user: { include: { subscription: true } } },
    });
    if (byRoot && evaluateSubscriptionAccess(byRoot.user.subscription).allowed) {
      page = byRoot;
    }
  }

  if (!page) {
    page = await systemPrisma.presellPage.findFirst({
      where: {
        userId: ownerId,
        customDomainId: cd.id,
        status: "published",
      },
      orderBy: [{ updatedAt: "desc" }],
      include: { user: { include: { subscription: true } } },
    });
  }

  if (!page) return null;
  if (!evaluateSubscriptionAccess(page.user.subscription).allowed) return null;
  return page.id;
}

async function ensurePlanFree() {
  const existing = await systemPrisma.plan.findUnique({ where: { id: "plan_free" } });
  if (existing) return existing.id;
  const p = await systemPrisma.plan.create({
    data: {
      id: "plan_free_mt",
      name: "MT Test Plan",
      type: "free_trial",
      priceCents: 0,
      maxPresellPages: 50,
      maxClicksPerMonth: 10000,
      hasBranding: false,
      features: [],
    },
  });
  return p.id;
}

async function cleanupTestUsers() {
  for (const email of [EMAIL_A, EMAIL_B]) {
    const u = await systemPrisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) continue;
    await systemPrisma.presellPage.deleteMany({ where: { userId: u.id } });
    await systemPrisma.customDomain.deleteMany({ where: { userId: u.id } });
    await systemPrisma.subscription.deleteMany({ where: { userId: u.id } });
    await systemPrisma.userRole.deleteMany({ where: { userId: u.id } });
    await systemPrisma.user.delete({ where: { id: u.id } });
  }
}

async function createUserWithSubscription(email: string, planId: string) {
  const password = await bcrypt.hash("mt-test-123", 8);
  const user = await systemPrisma.user.create({
    data: {
      email,
      password,
      fullName: `MT ${email}`,
    },
    select: { id: true },
  });
  await systemPrisma.subscription.create({
    data: {
      userId: user.id,
      planId,
      status: "active",
    },
  });
  return user;
}

async function main() {
  try {
    await systemPrisma.$queryRaw`SELECT 1`;
  } catch {
    console.warn("[skip] PostgreSQL indisponível.");
    process.exit(0);
  }

  const tableCheck = await systemPrisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'custom_domains' AND column_name = 'root_presell_id'
    ) AS exists
  `;
  if (!tableCheck[0]?.exists) {
    console.warn("[skip] Coluna custom_domains.root_presell_id inexistente — execute `npx prisma migrate deploy`.");
    process.exit(0);
  }

  await cleanupTestUsers();
  const planId = await ensurePlanFree();

  const userA = await createUserWithSubscription(EMAIL_A, planId);
  const userB = await createUserWithSubscription(EMAIL_B, planId);

  const hostA = `mt-a-${userA.id.slice(0, 8)}.local`;
  const hostB = `mt-b-${userB.id.slice(0, 8)}.local`;

  const domainA = await systemPrisma.customDomain.create({
    data: {
      userId: userA.id,
      hostname: hostA,
      verificationToken: "tok-a".padEnd(48, "0"),
      status: "verified",
      verifiedAt: new Date(),
      isDefault: true,
    },
  });

  const domainB = await systemPrisma.customDomain.create({
    data: {
      userId: userB.id,
      hostname: hostB,
      verificationToken: "tok-b".padEnd(48, "0"),
      status: "verified",
      verifiedAt: new Date(),
      isDefault: true,
    },
  });

  const pA1 = await systemPrisma.presellPage.create({
    data: {
      userId: userA.id,
      title: "Presell A1",
      slug: "a1-mt",
      type: "cookies",
      status: "published",
      customDomainId: domainA.id,
      content: {},
      settings: {},
    },
  });

  await new Promise((r) => setTimeout(r, 15));

  const pA2 = await systemPrisma.presellPage.create({
    data: {
      userId: userA.id,
      title: "Presell A2 newer",
      slug: "a2-mt",
      type: "cookies",
      status: "published",
      customDomainId: domainA.id,
      content: {},
      settings: {},
    },
  });

  const pB1 = await systemPrisma.presellPage.create({
    data: {
      userId: userB.id,
      title: "Presell B1",
      slug: "b1-mt",
      type: "cookies",
      status: "published",
      customDomainId: domainB.id,
      content: {},
      settings: {},
    },
  });

  // --- Sem root explícito: deve escolher a mais recentemente atualizada (pA2) ---
  const cdA0 = await systemPrisma.customDomain.findUniqueOrThrow({
    where: { id: domainA.id },
    select: { id: true, rootPresellId: true },
  });
  assert.equal(cdA0.rootPresellId, null);
  const rootAuto = await resolveRootPresellPageId(cdA0, userA.id);
  assert.equal(rootAuto, pA2.id, "automático deve preferir updatedAt mais recente");

  // --- Com root explícito: pA1 ---
  await systemPrisma.customDomain.update({
    where: { id: domainA.id },
    data: { rootPresellId: pA1.id },
  });
  const cdA1 = await systemPrisma.customDomain.findUniqueOrThrow({
    where: { id: domainA.id },
    select: { id: true, rootPresellId: true },
  });
  const rootExplicit = await resolveRootPresellPageId(cdA1, userA.id);
  assert.equal(rootExplicit, pA1.id, "root_presell_id deve vencer o fallback");

  // --- Multi-tenant: utilizador B não "vê" domínio A pelo hostname ---
  const wrongDomain = await systemPrisma.customDomain.findFirst({
    where: { userId: userB.id, hostname: hostA },
  });
  assert.equal(wrongDomain, null);

  // Mesmo filtro que PATCH /api/custom-domain/:id/root-presell (id + userId do JWT)
  const cannotPatchOtherTenantDomain = await systemPrisma.customDomain.findFirst({
    where: { id: domainA.id, userId: userB.id },
  });
  assert.equal(cannotPatchOtherTenantDomain, null);

  // --- Multi-tenant: presell de A não pertence ao filtro por userId B ---
  const steal = await systemPrisma.presellPage.findFirst({
    where: { id: pA1.id, userId: userB.id },
  });
  assert.equal(steal, null);

  // --- setRootPresell (validação): presell de A no domínio B não existe ---
  const crossLink = await systemPrisma.presellPage.findFirst({
    where: { id: pA1.id, userId: userB.id, customDomainId: domainB.id },
  });
  assert.equal(crossLink, null);

  // --- Conta B: raiz = única presell publicada ---
  const cdB = await systemPrisma.customDomain.findUniqueOrThrow({
    where: { id: domainB.id },
    select: { id: true, rootPresellId: true },
  });
  const rootB = await resolveRootPresellPageId(cdB, userB.id);
  assert.equal(rootB, pB1.id);

  await cleanupTestUsers();

  console.log("OK: presell root (automático + explícito) + isolamento multi-tenant.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

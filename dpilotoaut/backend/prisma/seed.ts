/**
 * Conta de desenvolvimento / seed. Não use estas credenciais em produção.
 * O `npm run dev` **não** executa isto. Ordem: `npm run db:push` (ou `db:migrate`) e depois `db:seed`, ou de uma vez: `npm run db:setup`.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Mínimo válido (alinhado a `getDefaultLandingDocument` no frontend) — evita import ESM no `tsx` do seed. */
const SEED_VENDAS_DOCUMENT: Prisma.InputJsonValue = {
  version: 1,
  sections: [
    {
      id: "seed-sec-1",
      type: "section",
      settings: { background: "muted", paddingY: "xl", fullBleed: false },
      children: [
        {
          id: "seed-hero-1",
          type: "hero",
          settings: {
            title: "Automatize o seu paid media",
            subtitle: "Copilot e autopilot com guardrails. Ligue Google Ads, Meta e TikTok num só lugar.",
            primaryCtaLabel: "Começar",
            primaryCtaHref: "/auth/sign-up",
            secondaryCtaLabel: "Entrar",
            secondaryCtaHref: "/auth/sign-in",
            align: "center",
          },
        },
      ],
    },
    {
      id: "seed-sec-2",
      type: "section",
      settings: { background: "default", paddingY: "lg" },
      children: [
        {
          id: "seed-h2",
          type: "heading",
          settings: { text: "Planos", level: 2, align: "center" },
        },
        {
          id: "seed-t1",
          type: "text",
          settings: {
            body: "Mensal, trimestral e anual. Desconto configurável nos pacotes 3 e 12 meses (padrão 10%). Ligue as URLs de checkout da Hotmart no widget de preços.",
            align: "center",
          },
        },
        {
          id: "seed-pr",
          type: "pricing",
          settings: {
            headline: "Escolha o plano",
            monthlyBase: 197,
            currency: "BRL",
            discountPercent: 10,
            planNames: { monthly: "Mensal", quarterly: "Trimestral", annual: "Anual" },
            features: [
              "Workspaces e equipa",
              "Google Ads, Meta, TikTok",
              "Aprovações e auditoria",
            ],
            ctaLabel: "Comprar na Hotmart",
            checkoutMonthly: "https://pay.hotmart.com/",
            checkoutQuarterly: "https://pay.hotmart.com/",
            checkoutAnnual: "https://pay.hotmart.com/",
          },
        },
      ],
    },
  ],
};

/** Garante landing pública no slug `vendas` (tela inicial `/`) com documento padrão após o primeiro `create`. */
async function ensureVendasLandingForSeed(userId: string) {
  const mem = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!mem) return;
  const doc = SEED_VENDAS_DOCUMENT;
  await prisma.landingPage.upsert({
    where: { slug: "vendas" },
    create: {
      organizationId: mem.organizationId,
      name: "Página de vendas (início)",
      slug: "vendas",
      isPublished: true,
      document: doc,
      theme: { primary: "hsl(142 70% 45%)", contentWidth: "max-w-5xl" },
      updatedById: userId,
    },
    update: {
      isPublished: true,
      updatedById: userId,
      organizationId: mem.organizationId,
    },
  });
}

const SEED = {
  fullName: "Daniel Pinto António",
  email: "daniel@gmail.com",
  password: "Dpiloto@123456",
} as const;

async function main() {
  const passwordHash = await bcrypt.hash(SEED.password, 12);

  const user = await prisma.user.upsert({
    where: { email: SEED.email },
    create: {
      email: SEED.email,
      fullName: SEED.fullName,
      passwordHash,
      isPlatformAdmin: true,
    },
    update: {
      fullName: SEED.fullName,
      passwordHash,
      isPlatformAdmin: true,
    },
  });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
  });

  if (membership) {
    if (membership.role !== "owner") {
      await prisma.organizationMember.update({
        where: { id: membership.id },
        data: { role: "owner" },
      });
    }
    await ensureVendasLandingForSeed(user.id);
    console.log(
      `Seed: utilizador ${SEED.email} já existia. Palavra-passe e função (owner) atualizadas se necessário. Landing «vendas» (início) garantida como publicada.`,
    );
    return;
  }

  const displayName =
    SEED.fullName.trim() || (SEED.email.includes("@") ? SEED.email.split("@")[0]! : "Workspace");
  let baseSlug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!baseSlug) baseSlug = "workspace";
  let uniqueSlug = baseSlug;
  let suffix = 0;
  while (await prisma.organization.findUnique({ where: { slug: uniqueSlug } })) {
    suffix += 1;
    uniqueSlug = `${baseSlug}-${suffix}`;
  }

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: `${displayName}'s Workspace`,
        slug: uniqueSlug,
        createdById: user.id,
        members: {
          create: { userId: user.id, role: "owner" },
        },
      },
    });

    const project = await tx.project.create({
      data: {
        organizationId: org.id,
        name: "Default Project",
        paidMode: "copilot",
      },
    });

    await tx.paidGuardrails.create({
      data: { projectId: project.id },
    });

    await tx.googleAdsConnection.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        status: "disconnected",
      },
    });

    await tx.metaConnection.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        status: "disconnected",
      },
    });

    await tx.tikTokConnection.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        status: "disconnected",
      },
    });
  });

  await ensureVendasLandingForSeed(user.id);
  console.log(`Seed ok: ${SEED.email} (admin) + workspace padrão + landing pública /vendas.`);
}

main()
  .catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      console.error(`
[seed] As tabelas ainda não existem nesta base (schema Prisma não aplicado).

Na raiz do repositório execute primeiro, **a partir da raiz** (não só em /backend):

  npm run db:push

ou, se usas migrações versionadas:

  npm run db:migrate

Depois:

  npm run db:seed

Atalho (push + seed): npm run db:setup
`);
      process.exit(1);
    }
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

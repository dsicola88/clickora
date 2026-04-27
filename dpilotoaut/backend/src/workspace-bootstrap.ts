import { prisma } from "./prisma";

/** Cria organização, projeto padrão, guardrails e conexões para um utilizador novo. */
export async function bootstrapWorkspaceForUser(userId: string, email: string, fullName: string) {
  const displayName =
    fullName.trim() ||
    (email.includes("@") ? email.split("@")[0] : "My Workspace") ||
    "My Workspace";

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
        createdById: userId,
        members: {
          create: { userId, role: "owner" },
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
}

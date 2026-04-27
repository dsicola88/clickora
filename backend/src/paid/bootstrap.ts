import { systemPrisma } from "../lib/prisma";

/** Garante um projecto padrão com ligações e guardrails (primeiro acesso a Anúncios). */
export async function ensurePaidAdsBootstrapForUser(userId: string, displayName: string) {
  const existing = await systemPrisma.paidAdsProject.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return systemPrisma.$transaction(async (tx) => {
    const project = await tx.paidAdsProject.create({
      data: {
        userId,
        name: "Default Project",
        websiteUrl: null,
        paidMode: "copilot",
      },
    });

    await tx.paidAdsGuardrails.create({
      data: { projectId: project.id },
    });

    await tx.paidAdsGoogleAdsConnection.create({
      data: {
        userId,
        projectId: project.id,
        status: "disconnected",
      },
    });

    await tx.paidAdsMetaConnection.create({
      data: {
        userId,
        projectId: project.id,
        status: "disconnected",
      },
    });

    await tx.paidAdsTikTokConnection.create({
      data: {
        userId,
        projectId: project.id,
        status: "disconnected",
      },
    });

    return project;
  });
}

/**
 * Garante guardrails e ligações (Google / Meta / TikTok) em projectos antigos ou incompletos,
 * evitando 500 em getOverview quando faltam linhas.
 */
export async function ensurePaidAdsProjectRows(projectId: string, ownerUserId: string) {
  await systemPrisma.$transaction(async (tx) => {
    await tx.paidAdsGuardrails.upsert({
      where: { projectId },
      create: { projectId },
      update: {},
    });
    await tx.paidAdsGoogleAdsConnection.upsert({
      where: { projectId },
      create: { userId: ownerUserId, projectId, status: "disconnected" },
      update: {},
    });
    await tx.paidAdsMetaConnection.upsert({
      where: { projectId },
      create: { userId: ownerUserId, projectId, status: "disconnected" },
      update: {},
    });
    await tx.paidAdsTikTokConnection.upsert({
      where: { projectId },
      create: { userId: ownerUserId, projectId, status: "disconnected" },
      update: {},
    });
  });
}

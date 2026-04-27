/**
 * Multitenancy: cada **Organization** é um tenant (workspace isolado).
 * Todos os projectos, campanhas e pedidos vivem debaixo de `organizationId`.
 * Aplicação: todas as leituras/escritas de dados “paid” têm de passar por `projectId`
 * ou `organizationId` com verificação de `OrganizationMember`.
 */
import { prisma } from "./prisma";

export type WorkspaceRow = {
  organizationId: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "viewer";
};

/** Projecto acessível pelo utilizador (membro da org do projecto) ou `null`. */
export async function getProjectForMember(
  projectId: string,
  userId: string,
): Promise<{ id: string; organizationId: string; name: string } | null> {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { members: { some: { userId } } },
    },
    select: { id: true, organizationId: true, name: true },
  });
}

export async function assertProjectMember(
  projectId: string,
  userId: string,
): Promise<{ id: string; organizationId: string; name: string }> {
  const p = await getProjectForMember(projectId, userId);
  if (!p) throw new Error("Sem acesso a este projeto.");
  return p;
}

/** Lista workspaces onde o utilizador é membro (multi-tenant). */
export async function listWorkspacesForUser(userId: string): Promise<WorkspaceRow[]> {
  const members = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => ({
    organizationId: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));
}

export async function assertUserInOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  const m = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  if (!m) throw new Error("Sem acesso a esta conta.");
}

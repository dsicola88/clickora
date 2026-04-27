import { prisma } from "./prisma";
import { getProjectForMember } from "./tenancy";

export async function canAccessProject(projectId: string, userId: string): Promise<boolean> {
  return Boolean(await getProjectForMember(projectId, userId));
}

export async function canWriteProject(projectId: string, userId: string): Promise<boolean> {
  const row = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        members: {
          some: {
            userId,
            role: { in: ["owner", "admin", "member"] },
          },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function canAdminProject(projectId: string, userId: string): Promise<boolean> {
  const row = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        members: {
          some: {
            userId,
            role: { in: ["owner", "admin"] },
          },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function canAdminOrganization(organizationId: string, userId: string): Promise<boolean> {
  const row = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: { in: ["owner", "admin"] },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getOrgMemberRole(
  organizationId: string,
  userId: string,
): Promise<"owner" | "admin" | "member" | "viewer" | null> {
  const row = await prisma.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  return row?.role ?? null;
}

export async function isOrganizationOwner(organizationId: string, userId: string): Promise<boolean> {
  const r = await getOrgMemberRole(organizationId, userId);
  return r === "owner";
}

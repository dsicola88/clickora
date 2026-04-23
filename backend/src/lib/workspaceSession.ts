import type { WorkspaceRole } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { parseExtraPermissions } from "./rbac";

export type WorkspaceSessionClaims = {
  tenantUserId: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  workspacePermissions: string[];
};

/**
 * Resolve o contexto de workspace para o JWT após login.
 * Sem linhas em `workspace_members` (BD antiga / migração pendente), assume conta individual.
 */
export async function resolveWorkspaceSessionForLogin(userId: string): Promise<WorkspaceSessionClaims> {
  const m = await systemPrisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!m) {
    const u = await systemPrisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { workspaceId: true },
    });
    return {
      tenantUserId: userId,
      workspaceId: u.workspaceId,
      workspaceRole: "owner",
      workspacePermissions: [],
    };
  }
  return {
    tenantUserId: m.workspace.ownerUserId,
    workspaceId: m.workspaceId,
    workspaceRole: m.role,
    workspacePermissions: parseExtraPermissions(m.permissions),
  };
}

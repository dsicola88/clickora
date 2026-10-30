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
      select: { workspaceId: true, fullName: true, email: true },
    });
    /**
     * `users.workspace_id` é um UUID local (não FK). Sem linha em `workspaces`,
     * audit logs e rotas de workspace quebram com P2003 — garantir workspace pessoal no login.
     */
    await systemPrisma.workspace.upsert({
      where: { ownerUserId: userId },
      create: {
        id: u.workspaceId,
        ownerUserId: userId,
        name: (u.fullName || u.email || "Personal").slice(0, 200),
      },
      update: {},
    });
    const ws = await systemPrisma.workspace.findUniqueOrThrow({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (ws.id !== u.workspaceId) {
      await systemPrisma.user.update({
        where: { id: userId },
        data: { workspaceId: ws.id },
      });
    }
    await systemPrisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId } },
      create: { workspaceId: ws.id, userId, role: "owner" },
      update: { role: "owner" },
    });
    return {
      tenantUserId: userId,
      workspaceId: ws.id,
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

/**
 * Troca o workspace activo: o actor tem de ser membro.
 * Devolve claims para reemitir o JWT (tenant = dono do workspace).
 */
export async function resolveWorkspaceSessionForSwitch(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceSessionClaims | null> {
  const wid = workspaceId.trim();
  if (!wid) return null;
  const m = await systemPrisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: wid, userId } },
    include: { workspace: { select: { ownerUserId: true, id: true, name: true } } },
  });
  if (!m) return null;
  return {
    tenantUserId: m.workspace.ownerUserId,
    workspaceId: m.workspaceId,
    workspaceRole: m.role,
    workspacePermissions: parseExtraPermissions(m.permissions),
  };
}

/** Preferir o workspace do JWT se a membership ainda for válida. */
export async function resolveWorkspaceSessionFromRequest(
  userId: string,
  claimedWorkspaceId?: string | null,
): Promise<WorkspaceSessionClaims & { workspaceName?: string }> {
  const claimed = claimedWorkspaceId?.trim();
  if (claimed) {
    const switched = await resolveWorkspaceSessionForSwitch(userId, claimed);
    if (switched) {
      const ws = await systemPrisma.workspace.findUnique({
        where: { id: switched.workspaceId },
        select: { name: true },
      });
      return { ...switched, workspaceName: ws?.name };
    }
  }
  const sess = await resolveWorkspaceSessionForLogin(userId);
  const ws = await systemPrisma.workspace.findUnique({
    where: { id: sess.workspaceId },
    select: { name: true },
  });
  return { ...sess, workspaceName: ws?.name };
}

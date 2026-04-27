import type { Request } from "express";
import type { WorkspaceRole } from "@prisma/client";
import { systemPrisma } from "../lib/prisma";
import type { JwtPayload } from "../lib/jwt";

function getTenantId(u: JwtPayload): string {
  return u.tenantUserId ?? u.userId;
}

/** Projecto acessível pelo utilizador (owner ou membro de workspace cujo dono = project.userId). */
export async function getProjectForMember(
  projectId: string,
  actorUserId: string,
  tenantUserId: string,
): Promise<{ id: string; userId: string; name: string } | null> {
  const p = await systemPrisma.paidAdsProject.findFirst({
    where: { id: projectId, userId: tenantUserId },
    select: { id: true, userId: true, name: true },
  });
  if (!p) return null;
  if (actorUserId === tenantUserId) return p;
  const m = await systemPrisma.workspaceMember.findFirst({
    where: { userId: actorUserId, workspace: { ownerUserId: tenantUserId } },
    select: { id: true, role: true },
  });
  if (!m) return null;
  return p;
}

export async function assertProjectMember(
  projectId: string,
  actorUserId: string,
  tenantUserId: string,
): Promise<{ id: string; userId: string; name: string }> {
  const p = await getProjectForMember(projectId, actorUserId, tenantUserId);
  if (!p) throw new Error("Sem acesso a este projeto.");
  return p;
}

function roleCanWrite(r: WorkspaceRole): boolean {
  return r === "owner" || r === "admin" || r === "member";
}
function roleCanAdmin(r: WorkspaceRole): boolean {
  return r === "owner" || r === "admin";
}

async function getActorWorkspaceRole(actorUserId: string, ownerUserId: string): Promise<WorkspaceRole | null> {
  if (actorUserId === ownerUserId) return "owner";
  const m = await systemPrisma.workspaceMember.findFirst({
    where: { userId: actorUserId, workspace: { ownerUserId } },
    select: { role: true },
  });
  return m?.role ?? null;
}

export async function canAccessProject(
  projectId: string,
  userId: string,
  tenantUserId: string,
): Promise<boolean> {
  return Boolean(await getProjectForMember(projectId, userId, tenantUserId));
}

export async function canWriteProject(projectId: string, userId: string, tenantUserId: string): Promise<boolean> {
  const p = await getProjectForMember(projectId, userId, tenantUserId);
  if (!p) return false;
  const r = await getActorWorkspaceRole(userId, tenantUserId);
  return r != null && roleCanWrite(r);
}

export async function canAdminProject(projectId: string, userId: string, tenantUserId: string): Promise<boolean> {
  const p = await getProjectForMember(projectId, userId, tenantUserId);
  if (!p) return false;
  const r = await getActorWorkspaceRole(userId, tenantUserId);
  return r != null && roleCanAdmin(r);
}

export function getPaidActor(req: Request) {
  const u = (req as Request & { user?: JwtPayload }).user;
  if (!u) return null;
  return {
    userId: u.userId,
    tenantUserId: getTenantId(u),
  };
}

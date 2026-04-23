import type { Request } from "express";
import type { WorkspaceRole } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { actorUserId, billingUserId } from "./requestContext";
import type { JwtPayload } from "./jwt";

export async function resolveWorkspaceIdForRequest(req: Request): Promise<string | null> {
  const j = req.user as JwtPayload;
  if (j.workspaceId) return j.workspaceId;
  const w = await systemPrisma.workspace.findFirst({
    where: { ownerUserId: billingUserId(req) },
    select: { id: true },
  });
  return w?.id ?? null;
}

export async function loadActorWorkspaceMember(req: Request): Promise<{
  workspaceId: string | null;
  role: WorkspaceRole;
  permissions: unknown;
}> {
  const j = req.user as JwtPayload;
  const wid = await resolveWorkspaceIdForRequest(req);
  if (!wid) {
    return { workspaceId: null, role: j.workspaceRole ?? "owner", permissions: null };
  }
  const m = await systemPrisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: wid, userId: actorUserId(req) } },
  });
  return {
    workspaceId: wid,
    role: m?.role ?? j.workspaceRole ?? "owner",
    permissions: m?.permissions ?? null,
  };
}

import type { WorkspaceRole } from "@prisma/client";
import { systemPrisma } from "./prisma";
import type { JwtPayload } from "./jwt";

function asPermissionList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return value as string[];
  }
  return fallback;
}

/**
 * Revalida membership de workspace no JWT.
 * Se o actor foi removido da conta, cai no próprio userId (não mantém tenant alienígena).
 */
export async function resolveLiveWorkspaceClaims(raw: JwtPayload): Promise<{
  tenantUserId: string;
  workspaceId?: string;
  workspaceRole: WorkspaceRole;
  workspacePermissions: string[];
}> {
  const actorId = raw.userId;
  const claimedTenant = raw.tenantUserId ?? raw.userId;
  if (!claimedTenant || claimedTenant === actorId) {
    return {
      tenantUserId: actorId,
      workspaceId: raw.workspaceId,
      workspaceRole: raw.workspaceRole ?? "owner",
      workspacePermissions: raw.workspacePermissions ?? [],
    };
  }

  const member = await systemPrisma.workspaceMember.findFirst({
    where: {
      userId: actorId,
      workspace: { ownerUserId: claimedTenant },
      ...(raw.workspaceId ? { workspaceId: raw.workspaceId } : {}),
    },
    select: { workspaceId: true, role: true, permissions: true },
  });

  if (!member) {
    return {
      tenantUserId: actorId,
      workspaceId: undefined,
      workspaceRole: "owner",
      workspacePermissions: [],
    };
  }

  return {
    tenantUserId: claimedTenant,
    workspaceId: member.workspaceId,
    workspaceRole: member.role ?? raw.workspaceRole ?? "member",
    workspacePermissions: asPermissionList(member.permissions, raw.workspacePermissions ?? []),
  };
}

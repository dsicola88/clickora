import type { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

export async function appendWorkspaceAuditLog(args: {
  workspaceId: string;
  actorUserId: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await systemPrisma.workspaceAuditLog.create({
    data: {
      workspaceId: args.workspaceId,
      actorUserId: args.actorUserId,
      action: args.action.slice(0, 160),
      resourceType: args.resourceType?.slice(0, 80) ?? null,
      resourceId: args.resourceId?.slice(0, 80) ?? null,
      metadata: (args.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

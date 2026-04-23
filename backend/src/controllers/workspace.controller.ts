import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma, WorkspaceRole } from "@prisma/client";
import { systemPrisma } from "../lib/prisma";
import { actorUserId, billingUserId } from "../lib/requestContext";
import { appendWorkspaceAuditLog } from "../lib/workspaceAudit";
import {
  parseExtraPermissions,
  workspaceCanManageMembers,
  workspaceCanWriteIntegrations,
  workspaceCanWritePresells,
  workspaceCanWriteRotators,
} from "../lib/rbac";
import { resolveWorkspaceIdForRequest, loadActorWorkspaceMember } from "../lib/workspaceRequest";

const addMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

const extraPermEnum = z.enum(["integrations:write", "rotators:write", "presells:write"]);

const patchMemberPermissionsSchema = z.object({
  permissions: z.union([z.array(extraPermEnum), z.null()]),
});

export const workspaceController = {
  async listMembers(req: Request, res: Response) {
    const wid = req.params.workspaceId?.trim();
    if (!wid) return res.status(400).json({ error: "workspaceId em falta" });
    const actor = actorUserId(req);
    const access = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: actor } },
    });
    if (!access) return res.status(403).json({ error: "Sem acesso a este workspace." });

    const rows = await systemPrisma.workspaceMember.findMany({
      where: { workspaceId: wid },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      rows.map((r) => ({
        user_id: r.userId,
        email: r.user.email,
        name: r.user.fullName,
        role: r.role,
        permissions: parseExtraPermissions(r.permissions),
        created_at: r.createdAt.toISOString(),
      })),
    );
  },

  async listMine(req: Request, res: Response) {
    const actor = actorUserId(req);
    const rows = await systemPrisma.workspaceMember.findMany({
      where: { userId: actor },
      include: {
        workspace: { select: { id: true, name: true, ownerUserId: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      rows.map((r) => ({
        workspace_id: r.workspace.id,
        name: r.workspace.name,
        owner_user_id: r.workspace.ownerUserId,
        role: r.role,
        created_at: r.workspace.createdAt.toISOString(),
      })),
    );
  },

  async audit(req: Request, res: Response) {
    const wid = req.params.workspaceId?.trim();
    if (!wid) return res.status(400).json({ error: "workspaceId em falta" });
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const member = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: actorUserId(req) } },
    });
    if (!member) return res.status(403).json({ error: "Sem acesso a este workspace." });

    const rows = await systemPrisma.workspaceAuditLog.findMany({
      where: { workspaceId: wid },
      orderBy: { createdAt: "desc" },
      take,
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        resource_type: r.resourceType,
        resource_id: r.resourceId,
        actor_user_id: r.actorUserId,
        metadata: r.metadata,
        created_at: r.createdAt.toISOString(),
      })),
    );
  },

  async addMember(req: Request, res: Response) {
    const wid = req.params.workspaceId?.trim();
    if (!wid) return res.status(400).json({ error: "workspaceId em falta" });
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const { role, email } = parsed.data;
    const actor = actorUserId(req);
    const m = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: actor } },
    });
    if (!m || !workspaceCanManageMembers(m.role)) {
      return res.status(403).json({ error: "Sem permissão para gerir membros." });
    }

    const target = await systemPrisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!target) {
      return res.status(404).json({ error: "Não existe utilizador com este e-mail. A conta tem de estar registada primeiro." });
    }

    if (target.id === billingUserId(req)) {
      return res.status(400).json({ error: "O dono da conta já é membro implícito." });
    }

    const dup = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: target.id } },
    });
    if (dup) return res.status(409).json({ error: "Este utilizador já pertence ao workspace." });

    await systemPrisma.workspaceMember.create({
      data: {
        workspaceId: wid,
        userId: target.id,
        role: role as WorkspaceRole,
      },
    });

    await appendWorkspaceAuditLog({
      workspaceId: wid,
      actorUserId: actor,
      action: "workspace.member_added",
      resourceType: "user",
      resourceId: target.id,
      metadata: { email: target.email, role },
    });

    res.status(201).json({ ok: true, user_id: target.id, role });
  },

  async removeMember(req: Request, res: Response) {
    const wid = req.params.workspaceId?.trim();
    const uid = req.params.userId?.trim();
    if (!wid || !uid) return res.status(400).json({ error: "Parâmetros em falta" });

    const actor = actorUserId(req);
    const m = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: actor } },
    });
    if (!m || !workspaceCanManageMembers(m.role)) {
      return res.status(403).json({ error: "Sem permissão para gerir membros." });
    }

    const victim = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: uid } },
    });
    if (!victim) return res.status(404).json({ error: "Membro não encontrado." });
    if (victim.role === "owner") {
      return res.status(400).json({ error: "Não é possível remover o dono do workspace." });
    }

    await systemPrisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: wid, userId: uid } },
    });

    await appendWorkspaceAuditLog({
      workspaceId: wid,
      actorUserId: actor,
      action: "workspace.member_removed",
      resourceType: "user",
      resourceId: uid,
    });

    res.status(204).end();
  },

  async patchMemberPermissions(req: Request, res: Response) {
    const wid = req.params.workspaceId?.trim();
    const uid = req.params.userId?.trim();
    if (!wid || !uid) return res.status(400).json({ error: "Parâmetros em falta" });

    const parsed = patchMemberPermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const { permissions } = parsed.data;

    const actor = actorUserId(req);
    const actorRow = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: actor } },
    });
    if (!actorRow || !workspaceCanManageMembers(actorRow.role)) {
      return res.status(403).json({ error: "Sem permissão para gerir membros." });
    }

    const victim = await systemPrisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: uid } },
    });
    if (!victim) return res.status(404).json({ error: "Membro não encontrado." });
    if (victim.role === "owner") {
      return res.status(400).json({ error: "Não é possível alterar permissões extra do dono." });
    }

    const jsonVal = permissions === null ? Prisma.JsonNull : permissions;

    await systemPrisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: wid, userId: uid } },
      data: { permissions: jsonVal },
    });

    await appendWorkspaceAuditLog({
      workspaceId: wid,
      actorUserId: actor,
      action: "workspace.member_permissions_updated",
      resourceType: "user",
      resourceId: uid,
      metadata: { permissions },
    });

    res.json({ ok: true, user_id: uid, permissions: permissions === null ? [] : permissions });
  },
};

/** Para controladores: nega escrita em rotadores se o papel não permitir. */
export async function denyIfCannotWriteRotators(req: Request, res: Response): Promise<boolean> {
  const wid = await resolveWorkspaceIdForRequest(req);
  if (!wid) return false;
  const { role, permissions } = await loadActorWorkspaceMember(req);
  if (!workspaceCanWriteRotators(role, permissions)) {
    res.status(403).json({ error: "Sem permissão para alterar rotadores neste workspace." });
    return true;
  }
  return false;
}

export async function denyIfCannotWritePresells(req: Request, res: Response): Promise<boolean> {
  const wid = await resolveWorkspaceIdForRequest(req);
  if (!wid) return false;
  const { role, permissions } = await loadActorWorkspaceMember(req);
  if (!workspaceCanWritePresells(role, permissions)) {
    res.status(403).json({ error: "Sem permissão para alterar presells neste workspace." });
    return true;
  }
  return false;
}

export async function denyIfCannotWriteIntegrations(req: Request, res: Response): Promise<boolean> {
  const wid = await resolveWorkspaceIdForRequest(req);
  if (!wid) return false;
  const { role, permissions } = await loadActorWorkspaceMember(req);
  if (!workspaceCanWriteIntegrations(role, permissions)) {
    res.status(403).json({ error: "Sem permissão para alterar integrações neste workspace." });
    return true;
  }
  return false;
}

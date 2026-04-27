import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSession } from "@/integrations/auth/auth-middleware";
import { prisma } from "@backend/prisma";
import { canAdminOrganization, getOrgMemberRole, isOrganizationOwner } from "@backend/permissions";

import type { AppRole } from "@prisma/client";

function computeRemoveAction(p: {
  isYou: boolean;
  targetRole: AppRole;
  actorRole: AppRole | null;
  ownersCount: number;
}): { can: boolean; label: "sair" | "remover" | null } {
  if (p.isYou) {
    if (p.targetRole === "owner" && p.ownersCount === 1) {
      return { can: false, label: null };
    }
    return { can: true, label: "sair" };
  }
  if (!p.actorRole || (p.actorRole !== "admin" && p.actorRole !== "owner")) {
    return { can: false, label: null };
  }
  if (p.actorRole === "admin" && (p.targetRole === "owner" || p.targetRole === "admin")) {
    return { can: false, label: null };
  }
  if (p.targetRole === "owner" && p.ownersCount <= 1) {
    return { can: false, label: null };
  }
  return { can: true, label: "remover" };
}

const projectIdInput = z.object({ projectId: z.string().uuid() });
const removeInput = z.object({
  projectId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export type OrganizationMemberRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  is_you: boolean;
  can_remove: boolean;
  action_label: "sair" | "remover" | null;
};

/** Lista membros da org do projecto. Qualquer membro vê; dados sensíveis mínimos. */
export const listProjectOrganizationMembers = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }): Promise<OrganizationMemberRow[]> => {
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { organizationId: true },
    });
    if (!project) {
      throw new Error("Projeto não encontrado ou sem acesso.");
    }

    const orgId = project.organizationId;
    const ownersCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "owner" },
    });
    const actorRole = await getOrgMemberRole(orgId, context.userId);

    const rows = await prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return rows.map((r) => {
      const isYou = r.userId === context.userId;
      const { can, label } = computeRemoveAction({
        isYou,
        targetRole: r.role,
        actorRole,
        ownersCount,
      });
      return {
        id: r.id,
        user_id: r.user.id,
        email: r.user.email,
        full_name: r.user.fullName,
        role: r.role,
        is_you: isYou,
        can_remove: can,
        action_label: label,
      };
    });
  });

export const removeProjectOrganizationMember = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => removeInput.parse(input))
  .handler(async ({ data, context }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { organizationId: true },
    });
    if (!project) {
      throw new Error("Projeto não encontrado ou sem acesso.");
    }
    const orgId = project.organizationId;
    const actorId = context.userId;

    const target = await prisma.organizationMember.findFirst({
      where: { id: data.memberId, organizationId: orgId },
      include: { user: { select: { email: true } } },
    });
    if (!target) {
      throw new Error("Membro não encontrado nesta organização.");
    }

    const self = target.userId === actorId;
    const ownersCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "owner" },
    });
    if (self && target.role === "owner" && ownersCount === 1) {
      throw new Error(
        "Não é possível sair: é o único owner. Transfira a propriedade a outro membro em Equipa ou crie um convite de admin e depois transfira.",
      );
    }

    if (self && target.role !== "owner") {
      await prisma.organizationMember.delete({ where: { id: target.id } });
      return { ok: true as const, left: true as const };
    }
    if (self && target.role === "owner" && ownersCount > 1) {
      await prisma.organizationMember.delete({ where: { id: target.id } });
      return { ok: true as const, left: true as const };
    }

    const canAdmin = await canAdminOrganization(orgId, actorId);
    if (!canAdmin) {
      throw new Error("Sem permissão para remover membros. Apenas administradores.");
    }

    const actorRole = await getOrgMemberRole(orgId, actorId);
    if (actorRole === "admin" && (target.role === "owner" || target.role === "admin")) {
      throw new Error("Apenas o owner da organização pode remover um owner ou outro admin.");
    }

    if (target.role === "owner" && ownersCount <= 1) {
      throw new Error("A organização tem de manter pelo menos um owner.");
    }

    await prisma.organizationMember.delete({ where: { id: target.id } });
    return { ok: true as const, left: false as const };
  });

const transferInput = z.object({
  projectId: z.string().uuid(),
  newOwnerMemberId: z.string().uuid(),
});

/** Quem chama tem de ser owner. O destino passa a único owner; o anterior e outros owners passam a admin. */
export const transferProjectOrganizationOwnership = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => transferInput.parse(input))
  .handler(async ({ data, context }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Projeto não encontrado ou sem acesso.");
    const orgId = project.organizationId;
    if (!(await isOrganizationOwner(orgId, context.userId))) {
      throw new Error("Apenas o owner do workspace pode transferir a propriedade.");
    }
    const target = await prisma.organizationMember.findFirst({
      where: { id: data.newOwnerMemberId, organizationId: orgId },
    });
    if (!target) throw new Error("Membro não encontrado.");
    if (target.userId === context.userId) {
      throw new Error("Escolha outro membro para ser o novo owner.");
    }
    await prisma.$transaction([
      prisma.organizationMember.updateMany({
        where: { organizationId: orgId, role: "owner" },
        data: { role: "admin" },
      }),
      prisma.organizationMember.update({
        where: { id: target.id },
        data: { role: "owner" },
      }),
    ]);
    return { ok: true as const };
  });

const inviteRole = z.enum(["member", "viewer", "admin"]);
const createInviteInput = z.object({
  projectId: z.string().uuid(),
  role: inviteRole,
  emailConstraint: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((s) => (s === "" || s === undefined ? undefined : s)),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export type OrganizationInviteRow = {
  id: string;
  role: "member" | "viewer" | "admin";
  expires_at: string;
  email_constraint: string | null;
  used_at: string | null;
  created_at: string;
  invite_path: string;
};

export const createOrganizationInvite = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => createInviteInput.parse(input))
  .handler(async ({ data, context }): Promise<OrganizationInviteRow> => {
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Projeto não encontrado ou sem acesso.");
    const orgId = project.organizationId;
    if (!(await canAdminOrganization(orgId, context.userId))) {
      throw new Error("Apenas administradores podem criar convites.");
    }
    const token = randomToken();
    const days = data.expiresInDays ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    const email =
      data.emailConstraint && data.emailConstraint.length > 0
        ? data.emailConstraint.trim().toLowerCase()
        : null;
    const row = await prisma.organizationInvite.create({
      data: {
        organizationId: orgId,
        role: data.role,
        token,
        expiresAt,
        createdById: context.userId,
        emailConstraint: email,
      },
    });
    return mapInviteRow(row);
  });

export const listOrganizationInvites = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => projectIdInput.parse(input))
  .handler(async ({ data, context }): Promise<OrganizationInviteRow[]> => {
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Projeto não encontrado ou sem acesso.");
    const orgId = project.organizationId;
    if (!(await canAdminOrganization(orgId, context.userId))) {
      throw new Error("Sem permissão.");
    }
    const rows = await prisma.organizationInvite.findMany({
      where: {
        organizationId: orgId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(mapInviteRow);
  });

const revokeInviteInput = z.object({
  projectId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

export const revokeOrganizationInvite = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => revokeInviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        organization: { members: { some: { userId: context.userId } } },
      },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Projeto não encontrado ou sem acesso.");
    const orgId = project.organizationId;
    if (!(await canAdminOrganization(orgId, context.userId))) {
      throw new Error("Sem permissão.");
    }
    const inv = await prisma.organizationInvite.findFirst({
      where: { id: data.inviteId, organizationId: orgId },
    });
    if (!inv) throw new Error("Convite não encontrado.");
    await prisma.organizationInvite.delete({ where: { id: inv.id } });
    return { ok: true as const };
  });

const acceptInviteInput = z.object({ token: z.string().min(10).max(500) });

export const acceptOrganizationInvite = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .inputValidator((input: unknown) => acceptInviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const inv = await prisma.organizationInvite.findUnique({
      where: { token: data.token },
    });
    if (!inv) throw new Error("Convite inválido.");
    if (inv.usedAt) throw new Error("Este convite já foi utilizado.");
    if (inv.expiresAt.getTime() < Date.now()) throw new Error("Convite expirado.");
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { email: true, fullName: true },
    });
    if (!user) throw new Error("Sessão inválida.");
    if (inv.emailConstraint) {
      if (user.email.toLowerCase() !== inv.emailConstraint.toLowerCase()) {
        throw new Error(
          `Este convite é apenas para o e-mail ${inv.emailConstraint}. Inicie sessão com essa conta.`,
        );
      }
    }
    const existing = await prisma.organizationMember.findFirst({
      where: { organizationId: inv.organizationId, userId: context.userId },
    });
    if (existing) {
      await prisma.organizationInvite.update({
        where: { id: inv.id },
        data: { usedAt: new Date(), usedByUserId: context.userId },
      });
      return { ok: true as const, alreadyMember: true as const, organizationId: inv.organizationId };
    }
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: inv.organizationId,
          userId: context.userId,
          role: inv.role,
        },
      }),
      prisma.organizationInvite.update({
        where: { id: inv.id },
        data: { usedAt: new Date(), usedByUserId: context.userId },
      }),
    ]);
    return { ok: true as const, alreadyMember: false as const, organizationId: inv.organizationId };
  });

function randomToken(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function mapInviteRow(row: {
  id: string;
  role: AppRole;
  token: string;
  expiresAt: Date;
  emailConstraint: string | null;
  usedAt: Date | null;
  createdAt: Date;
}): OrganizationInviteRow {
  return {
    id: row.id,
    role: row.role as "member" | "viewer" | "admin",
    expires_at: row.expiresAt.toISOString(),
    email_constraint: row.emailConstraint,
    used_at: row.usedAt ? row.usedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    invite_path: `/auth/accept-invite?token=${encodeURIComponent(row.token)}`,
  };
}

import type { PlanType } from "@prisma/client";
import prisma from "./prisma";

/**
 * Limites operacionais de seats e rotadores.
 * Coluna do plano (admin) tem prioridade; null = fallback por tipo.
 * Contas já acima do teto não são cortadas — só bloqueia creates/convites novos.
 */

/** Membros no workspace (inclui owner). Starter = solo. */
export function fallbackMaxWorkspaceMembers(type: PlanType | string | null | undefined): number | null {
  const t = String(type || "free_trial");
  if (t === "annual") return null;
  if (t === "monthly" || t === "quarterly") return 5;
  return 1; // free_trial — só o dono
}

/** Rotadores de tráfego (contagem total). */
export function fallbackMaxTrafficRotators(type: PlanType | string | null | undefined): number | null {
  const t = String(type || "free_trial");
  if (t === "annual") return null;
  if (t === "monthly" || t === "quarterly") return 25;
  return 3; // free_trial
}

export function effectiveMaxWorkspaceMembersFromPlan(plan: {
  type: PlanType | string;
  maxWorkspaceMembers?: number | null;
}): number | null {
  if (typeof plan.maxWorkspaceMembers === "number" && !Number.isNaN(plan.maxWorkspaceMembers)) {
    return Math.max(0, Math.floor(plan.maxWorkspaceMembers));
  }
  return fallbackMaxWorkspaceMembers(plan.type);
}

export function effectiveMaxTrafficRotatorsFromPlan(plan: {
  type: PlanType | string;
  maxTrafficRotators?: number | null;
}): number | null {
  if (typeof plan.maxTrafficRotators === "number" && !Number.isNaN(plan.maxTrafficRotators)) {
    return Math.max(0, Math.floor(plan.maxTrafficRotators));
  }
  return fallbackMaxTrafficRotators(plan.type);
}

export async function resolveWorkspaceMemberQuota(billingOwnerUserId: string): Promise<{
  maxMembers: number | null;
  used: number;
  canAdd: boolean;
  planType: PlanType | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: billingOwnerUserId },
    select: {
      workspaceId: true,
      subscription: {
        include: {
          plan: { select: { type: true, maxWorkspaceMembers: true } },
        },
      },
    },
  });
  const plan = user?.subscription?.plan ?? null;
  const planType = plan?.type ?? null;
  const maxMembers = plan
    ? effectiveMaxWorkspaceMembersFromPlan(plan)
    : fallbackMaxWorkspaceMembers(null);
  const wid = user?.workspaceId;
  const used = wid
    ? await prisma.workspaceMember.count({ where: { workspaceId: wid } })
    : 1;
  const canAdd = maxMembers == null || used < maxMembers;
  return { maxMembers, used, canAdd, planType };
}

export async function resolveTrafficRotatorQuota(billingOwnerUserId: string): Promise<{
  maxRotators: number | null;
  used: number;
  canAdd: boolean;
  planType: PlanType | null;
}> {
  const sub = await prisma.subscription.findUnique({
    where: { userId: billingOwnerUserId },
    include: { plan: { select: { type: true, maxTrafficRotators: true } } },
  });
  const plan = sub?.plan ?? null;
  const planType = plan?.type ?? null;
  const maxRotators = plan
    ? effectiveMaxTrafficRotatorsFromPlan(plan)
    : fallbackMaxTrafficRotators(null);
  const used = await prisma.trafficRotator.count({ where: { userId: billingOwnerUserId } });
  const canAdd = maxRotators == null || used < maxRotators;
  return { maxRotators, used, canAdd, planType };
}

export async function assertCanAddWorkspaceMember(billingOwnerUserId: string): Promise<
  | { ok: true }
  | { ok: false; status: 403; body: Record<string, unknown> }
> {
  const q = await resolveWorkspaceMemberQuota(billingOwnerUserId);
  if (q.canAdd) return { ok: true };
  return {
    ok: false,
    status: 403,
    body: {
      error: `Limite de ${q.maxMembers} membro(s) no plano atingido. Faça upgrade para convidar a equipa.`,
      code: "WORKSPACE_MEMBER_LIMIT",
      max_members: q.maxMembers,
      used: q.used,
    },
  };
}

export async function assertCanCreateTrafficRotator(billingOwnerUserId: string): Promise<
  | { ok: true }
  | { ok: false; status: 403; body: Record<string, unknown> }
> {
  const q = await resolveTrafficRotatorQuota(billingOwnerUserId);
  if (q.canAdd) return { ok: true };
  return {
    ok: false,
    status: 403,
    body: {
      error: `Limite de ${q.maxRotators} rotador(es) no plano atingido. Faça upgrade ou archive rotadores antigos.`,
      code: "TRAFFIC_ROTATOR_LIMIT",
      max_rotators: q.maxRotators,
      used: q.used,
    },
  };
}

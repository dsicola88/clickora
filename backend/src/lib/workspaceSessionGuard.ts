import type { WorkspaceRole } from "@prisma/client";
import { systemPrisma } from "./prisma";
import type { JwtPayload } from "./jwt";

function asPermissionList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return value as string[];
  }
  return fallback;
}

export class SessionUserGoneError extends Error {
  constructor() {
    super("Sessão de uma conta inexistente");
    this.name = "SessionUserGoneError";
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super("Sessão terminada (palavra-passe alterada ou sessões revogadas)");
    this.name = "SessionRevokedError";
  }
}

export type SessionGuardDb = Pick<typeof systemPrisma, "user" | "workspaceMember">;

type LiveWorkspaceClaims = {
  tenantUserId: string;
  workspaceId?: string;
  workspaceRole: WorkspaceRole;
  workspacePermissions: string[];
};

/** `iat` (segundos) anterior ao corte de revogação → token revogado. Mesmo segundo conta como válido. */
export function isTokenIssuedBeforeRevocation(iat: number | undefined, revokedAt: Date | null | undefined): boolean {
  if (!revokedAt) return false;
  const cutoff = Math.floor(revokedAt.getTime() / 1000);
  if (typeof iat !== "number" || !Number.isFinite(iat)) return true;
  return iat < cutoff;
}

function isMissingColumnError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === "P2022");
}

/** BD sem a coluna (migration ainda não aplicada): autentica sem revogação em vez de derrubar todas as sessões. */
async function findSessionActor(
  db: SessionGuardDb,
  userId: string,
): Promise<{ id: string; sessionsRevokedAt: Date | null } | null> {
  try {
    return await db.user.findUnique({ where: { id: userId }, select: { id: true, sessionsRevokedAt: true } });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const row = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    return row ? { id: row.id, sessionsRevokedAt: null } : null;
  }
}

/**
 * Sessão autenticada: a conta do actor tem de existir (JWT assinado de conta apagada → `SessionUserGoneError`),
 * o token não pode ser anterior a `sessionsRevokedAt` (`SessionRevokedError`)
 * e a membership de workspace é revalidada (`resolveWorkspaceMembershipClaims`).
 */
export async function resolveLiveWorkspaceClaims(
  raw: JwtPayload,
  db: SessionGuardDb = systemPrisma,
): Promise<LiveWorkspaceClaims> {
  if (!raw.userId) throw new SessionUserGoneError();
  const actor = await findSessionActor(db, raw.userId);
  if (!actor) throw new SessionUserGoneError();
  if (isTokenIssuedBeforeRevocation(raw.iat, actor.sessionsRevokedAt)) throw new SessionRevokedError();
  return resolveWorkspaceMembershipClaims(raw, db);
}

/**
 * Revalida membership de workspace no JWT (sem verificar a existência da conta do actor).
 * Se o actor foi removido da conta, cai no próprio userId (não mantém tenant alienígena).
 */
export async function resolveWorkspaceMembershipClaims(
  raw: JwtPayload,
  db: SessionGuardDb = systemPrisma,
): Promise<LiveWorkspaceClaims> {
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

  const member = await db.workspaceMember.findFirst({
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

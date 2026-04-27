import { prisma } from "./prisma";
import { isUserPlatformAdminById } from "./platform-admin";

type MemberRole = "owner" | "admin" | "member" | "viewer";

/**
 * Acesso a landings: cada página está ligada a uma organização (tenant).
 * Leitura: qualquer membro. Escrita/criação/eliminação: só `owner` ou `admin` da org,
 * ou administrador da plataforma.
 */
export async function canReadOrgLanding(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  if (await isUserPlatformAdminById(userId)) return true;
  const m = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  return Boolean(m);
}

export async function canWriteOrgLanding(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  if (await isUserPlatformAdminById(userId)) return true;
  const m = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!m) return false;
  return m.role === "owner" || m.role === "admin";
}

export async function assertCanReadOrgLanding(
  userId: string,
  organizationId: string,
): Promise<void> {
  if (await canReadOrgLanding(userId, organizationId)) return;
  throw new Response("Forbidden", { status: 403 });
}

export async function assertCanWriteOrgLanding(
  userId: string,
  organizationId: string,
): Promise<void> {
  if (await canWriteOrgLanding(userId, organizationId)) return;
  throw new Response("Forbidden", { status: 403 });
}

/** Só leitores não podem alterar. */
function roleCanManageLandings(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export async function getUserLandingRole(
  userId: string,
  organizationId: string,
): Promise<"none" | "read" | "write"> {
  if (await isUserPlatformAdminById(userId)) return "write";
  const m = await prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!m) return "none";
  if (roleCanManageLandings(m.role as MemberRole)) return "write";
  return "read";
}

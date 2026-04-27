import { prisma } from "./prisma";

/**
 * Administrador da **plataforma** (produto, métricas globais, operação) —
 * distinto de `AppRole.admin` numa Organization.
 */
export function isPlatformAdmin(user: { isPlatformAdmin: boolean; email: string }): boolean {
  if (user.isPlatformAdmin) return true;
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(user.email.toLowerCase());
}

export async function isUserPlatformAdminById(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true, email: true },
  });
  if (!user) return false;
  return isPlatformAdmin({ isPlatformAdmin: user.isPlatformAdmin, email: user.email });
}

export async function setUserPlatformAdmin(userId: string, value: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isPlatformAdmin: value },
  });
}

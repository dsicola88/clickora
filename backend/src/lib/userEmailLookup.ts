import { systemPrisma } from "./prisma";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Contas antigas podem ter o e-mail gravado com maiúsculas (`email` é único com distinção).
 * Ordem: exacto como escrito → minúsculas → sem distinção (o mais antigo, se houver duplicados).
 */
export async function findUserIdByEmail(raw: string): Promise<string | null> {
  const typed = raw.trim();
  if (!typed) return null;
  const exact = await systemPrisma.user.findUnique({ where: { email: typed }, select: { id: true } });
  if (exact) return exact.id;
  const normalized = normalizeEmail(typed);
  if (normalized !== typed) {
    const lower = await systemPrisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
    if (lower) return lower.id;
  }
  const loose = await systemPrisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return loose?.id ?? null;
}

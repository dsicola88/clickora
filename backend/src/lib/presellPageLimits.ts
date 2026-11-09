import prisma from "./prisma";

/**
 * Limite comercial de páginas presell do plano do dono da conta (billing tenant).
 * `null` = ilimitado. Usado por create, duplicate e variant pack.
 */
export async function resolvePresellPageQuota(userId: string): Promise<{
  maxPages: number | null;
  used: number;
  remaining: number | null;
}> {
  const [used, sub] = await Promise.all([
    prisma.presellPage.count({ where: { userId } }),
    prisma.subscription.findUnique({
      where: { userId },
      include: { plan: { select: { maxPresellPages: true } } },
    }),
  ]);
  const maxPages = sub?.plan.maxPresellPages ?? null;
  const remaining = maxPages == null ? null : Math.max(0, maxPages - used);
  return { maxPages, used, remaining };
}

export type PresellPageLimitDenied = {
  ok: false;
  status: 403;
  body: { error: string; code: "PRESELL_PAGE_LIMIT"; max_pages: number; used: number; requested: number };
};

export type PresellPageLimitOk = {
  ok: true;
  maxPages: number | null;
  used: number;
};

/**
 * Garante que ainda há espaço para `additionalCount` páginas novas.
 * Não altera o estado — só lê contagem + plano.
 */
export async function assertCanCreatePresellPages(
  userId: string,
  additionalCount = 1,
): Promise<PresellPageLimitOk | PresellPageLimitDenied> {
  const n = Math.max(0, Math.floor(additionalCount));
  if (n <= 0) {
    const q = await resolvePresellPageQuota(userId);
    return { ok: true, maxPages: q.maxPages, used: q.used };
  }

  const { maxPages, used } = await resolvePresellPageQuota(userId);
  if (maxPages == null) {
    return { ok: true, maxPages: null, used };
  }
  if (used + n > maxPages) {
    return {
      ok: false,
      status: 403,
      body: {
        error: `Limite de ${maxPages} páginas atingido. Faça upgrade do seu plano.`,
        code: "PRESELL_PAGE_LIMIT",
        max_pages: maxPages,
        used,
        requested: n,
      },
    };
  }
  return { ok: true, maxPages, used };
}

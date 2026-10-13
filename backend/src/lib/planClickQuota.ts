import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

/** Início do mês civil em UTC. O painel e o aviso de quota usam esta mesma janela. */
export function utcMonthStart(now = new Date()): Date {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Cliques do plano neste mês: a mesma conta do painel.
 * Bots e cliques marcados para ficar fora dos números não entram.
 */
export async function countPlanClicksThisMonth(userId: string, now = new Date()): Promise<number> {
  const since = utcMonthStart(now);
  const rows = await systemPrisma.$queryRaw<Array<{ cnt: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS cnt
    FROM tracking_events
    WHERE user_id = ${userId}
      AND event_type::text = 'click'
      AND created_at >= ${since}
      AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
      AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
  `);
  return Number(rows[0]?.cnt ?? 0);
}

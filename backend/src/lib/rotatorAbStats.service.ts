import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

export type RotatorAbArmRow = {
  arm_id: string;
  label: string | null;
  order_index: number;
  current_weight: number;
  clicks: number;
  conversions: number;
  revenue: string;
  conversion_rate: number;
};

/**
 * Estatísticas por braço (cliques e conversões no rotador) para A/B e «promover vencedor».
 */
export async function getRotatorAbStats(args: { userId: string; rotatorId: string; lookbackDays: number }) {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(0, Math.min(365 * 2, args.lookbackDays)));

  const rot = await systemPrisma.trafficRotator.findFirst({
    where: { id: args.rotatorId, userId: args.userId },
    include: { arms: { orderBy: { orderIndex: "asc" } } },
  });
  if (!rot) return null;

  const raw = await systemPrisma.$queryRaw<
    { arm_id: string; clicks: bigint; conversions: bigint; revenue: Prisma.Decimal | null }[]
  >(
    Prisma.sql`
    SELECT
      (te.metadata->>'rotator_arm_id') AS arm_id,
      COUNT(DISTINCT te.id) FILTER (
        WHERE NOT COALESCE((te.metadata->>'rotator_used_backup') = 'true', false)
      )::bigint AS clicks,
      COUNT(DISTINCT c.id)::bigint AS conversions,
      COALESCE(SUM(c.amount), 0) AS revenue
    FROM tracking_events te
    LEFT JOIN conversions c ON c.click_id = te.id AND c.user_id = te.user_id
    WHERE te.user_id = ${args.userId}::uuid
      AND te.event_type = 'click'
      AND te.metadata->>'rotator_id' = ${args.rotatorId}
      AND (te.metadata->>'rotator_arm_id') IS NOT NULL
      AND te.created_at >= ${since}
    GROUP BY 1
  `,
  );

  const byArm = new Map(
    raw.map((r) => [
      r.arm_id,
      {
        clicks: Number(r.clicks),
        conversions: Number(r.conversions),
        revenue: r.revenue != null ? String(r.revenue) : "0",
      },
    ]),
  );

  const rows: RotatorAbArmRow[] = rot.arms.map((a) => {
    const s = byArm.get(a.id) ?? { clicks: 0, conversions: 0, revenue: "0" };
    const rate = s.clicks > 0 ? s.conversions / s.clicks : 0;
    return {
      arm_id: a.id,
      label: a.label,
      order_index: a.orderIndex,
      current_weight: a.weight,
      clicks: s.clicks,
      conversions: s.conversions,
      revenue: s.revenue,
      conversion_rate: rate,
    };
  });

  return {
    rotator_id: rot.id,
    lookback_from: since.toISOString(),
    arms: rows,
  };
}

/**
 * Aplica 100% do tráfego ao braço vencedor (pesos: vencedor 100, restantes 0) e força modo `weighted`.
 */
export async function promoteRotatorWinner(args: {
  userId: string;
  rotatorId: string;
  metric: "conversion_rate" | "revenue";
  lookbackDays: number;
  minClicksPerArm: number;
}) {
  const stats = await getRotatorAbStats({
    userId: args.userId,
    rotatorId: args.rotatorId,
    lookbackDays: args.lookbackDays,
  });
  if (!stats) return { ok: false as const, error: "not_found" as const };

  const min = Math.max(0, args.minClicksPerArm);
  const candidates = stats.arms.filter((a) => a.current_weight > 0 && a.clicks >= min);
  if (candidates.length === 0) {
    return { ok: false as const, error: "insufficient_data" as const, message: "Nenhum braço com tráfego activo e cliques suficientes no período." };
  }

  const score = (a: RotatorAbArmRow) => {
    if (args.metric === "revenue") return parseFloat(a.revenue) || 0;
    return a.conversion_rate;
  };

  const sorted = [...candidates].sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    const dr = parseFloat(b.revenue) - parseFloat(a.revenue);
    if (dr !== 0) return dr;
    return a.order_index - b.order_index;
  });
  const winner = sorted[0]!;

  await systemPrisma.$transaction(async (tx) => {
    for (const arm of await tx.trafficRotatorArm.findMany({ where: { rotatorId: args.rotatorId } })) {
      const w = arm.id === winner.arm_id ? 100 : 0;
      await tx.trafficRotatorArm.update({ where: { id: arm.id }, data: { weight: w } });
    }
    await tx.trafficRotator.update({
      where: { id: args.rotatorId, userId: args.userId },
      data: { mode: "weighted" },
    });
  });

  return {
    ok: true as const,
    winner_arm_id: winner.arm_id,
    winner_label: winner.label,
    metric: args.metric,
    summary: { candidates_evaluated: candidates.length, lookback_from: stats.lookback_from },
  };
}

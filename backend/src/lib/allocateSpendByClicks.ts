/**
 * Atribui custo do período a linhas (rotador / braço) por quota de cliques.
 * Só a fatia `poolClicks / entryClicks` do spend entra no pool — sem inventar
 * custo em tráfego que não passou pelo rotador.
 * A soma dos `cost` iguala o pool (resto de arredondamento na maior linha).
 */
export function allocatePeriodSpendByClicks<T extends { clicks: number; revenue: number }>(
  rows: T[],
  spend: number | null,
  entryClicks: number,
): Array<T & { cost: number | null; profit: number | null; roas: number | null }> {
  if (spend == null || !(spend > 0) || entryClicks <= 0 || rows.length === 0) {
    return rows.map((r) => ({ ...r, cost: null, profit: null, roas: null }));
  }

  const poolClicks = rows.reduce((n, r) => n + Math.max(0, r.clicks), 0);
  if (poolClicks <= 0) {
    return rows.map((r) => ({ ...r, cost: null, profit: null, roas: null }));
  }

  const shareOfAccount = Math.min(1, poolClicks / entryClicks);
  const poolSpend = Math.round(spend * shareOfAccount * 100) / 100;

  const provisional = rows.map((r) => {
    const clicks = Math.max(0, r.clicks);
    const cost = Math.round((poolSpend * (clicks / poolClicks)) * 100) / 100;
    return { ...r, cost };
  });

  const allocated = provisional.reduce((n, r) => n + (r.cost ?? 0), 0);
  const drift = Math.round((poolSpend - allocated) * 100) / 100;
  if (drift !== 0 && provisional.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < provisional.length; i++) {
      if (provisional[i]!.clicks > provisional[bestIdx]!.clicks) bestIdx = i;
    }
    provisional[bestIdx]!.cost =
      Math.round(((provisional[bestIdx]!.cost ?? 0) + drift) * 100) / 100;
  }

  return provisional.map((r) => {
    const cost = r.cost;
    const profit =
      cost != null ? Math.round((r.revenue - cost) * 100) / 100 : null;
    const roas = cost != null && cost > 0 ? Math.round((r.revenue / cost) * 100) / 100 : null;
    return { ...r, cost, profit, roas };
  });
}

/** Soma dos custos alocados (null se todos null). */
export function sumAllocatedCost(
  rows: Array<{ cost: number | null }>,
): number | null {
  if (!rows.some((r) => r.cost != null)) return null;
  return Math.round(rows.reduce((n, r) => n + (r.cost ?? 0), 0) * 100) / 100;
}

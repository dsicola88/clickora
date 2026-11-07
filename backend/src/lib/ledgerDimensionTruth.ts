/**
 * Confiança comercial: vendas/receita por dimensão têm de somar o total do ledger
 * (Conversion approved no período). Cliques continuam click-centric; vendas são
 * conversion-centric e fundem-se sem inventar funil.
 */

export type DimClickRow = {
  key: string;
  clicks: number;
};

export type DimSaleRow = {
  key: string;
  sales: number;
  revenue: number;
};

export type DimMergedRow = {
  key: string;
  clicks: number;
  sales: number;
  revenue: number;
};

export type DimensionReconcile = {
  ok: boolean;
  sales_sum: number;
  revenue_sum: number;
  expected_sales: number;
  expected_revenue: number;
  sales_delta: number;
  revenue_delta: number;
};

/** Junta cliques (por dimensão) com vendas canónicas (Conversion). */
export function mergeDimensionClicksWithSales(
  clickRows: DimClickRow[],
  saleRows: DimSaleRow[],
): DimMergedRow[] {
  const map = new Map<string, DimMergedRow>();
  for (const row of clickRows) {
    const key = row.key || "";
    const prev = map.get(key);
    if (prev) {
      prev.clicks += row.clicks;
    } else {
      map.set(key, { key, clicks: row.clicks, sales: 0, revenue: 0 });
    }
  }
  for (const row of saleRows) {
    const key = row.key || "";
    const prev = map.get(key);
    if (prev) {
      prev.sales += row.sales;
      prev.revenue = Math.round((prev.revenue + row.revenue) * 100) / 100;
    } else {
      map.set(key, {
        key,
        clicks: 0,
        sales: row.sales,
        revenue: Math.round(row.revenue * 100) / 100,
      });
    }
  }
  return [...map.values()];
}

/** Invariante: Σ sales/revenue das dimensões = totais do ledger. */
export function reconcileDimensionAgainstLedger(
  rows: Array<{ sales: number; revenue: number }>,
  expected: { sales: number; revenue: number },
  epsilon = 0.001,
): DimensionReconcile {
  const sales_sum = rows.reduce((s, r) => s + r.sales, 0);
  const revenue_sum =
    Math.round(rows.reduce((s, r) => s + r.revenue, 0) * 100) / 100;
  const sales_delta = sales_sum - expected.sales;
  const revenue_delta = Math.round((revenue_sum - expected.revenue) * 100) / 100;
  return {
    ok:
      sales_delta === 0 && Math.abs(revenue_delta) <= epsilon,
    sales_sum,
    revenue_sum,
    expected_sales: expected.sales,
    expected_revenue: expected.revenue,
    sales_delta,
    revenue_delta,
  };
}

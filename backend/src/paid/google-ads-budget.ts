/**
 * Metadados de orçamento Google Ads (partilhado vs exclusivo).
 * Usado no pré-voo da UI e no bloqueio de mutate.
 */

export function isGoogleBudgetEditable(explicitlyShared: boolean, referenceCount: number): boolean {
  return !(explicitlyShared && referenceCount > 1);
}

export function sharedBudgetBlockMessage(referenceCount: number): string {
  return `Orçamento partilhado por ${referenceCount} campanhas na Google. Alterar aqui afectaria outras campanhas. Separe o orçamento na consola Google ou escolha um orçamento exclusivo antes de ajustar na Dclickora.`;
}

export type GoogleBudgetShareMeta = {
  explicitly_shared: boolean;
  reference_count: number;
  budget_editable: boolean;
  amount_micros: number | null;
};

/** Lê campos `campaignBudget` / `campaign_budget` de uma linha GAQL. */
export function parseGoogleBudgetShareFromRow(row: Record<string, unknown> | null | undefined): GoogleBudgetShareMeta {
  const budget = ((row?.campaignBudget ?? row?.campaign_budget ?? {}) as {
    explicitlyShared?: boolean;
    referenceCount?: number | string;
    amountMicros?: string | number;
  }) ?? {};
  const explicitly_shared = Boolean(budget.explicitlyShared);
  const rawRef = Number(budget.referenceCount ?? 1);
  const reference_count = Number.isFinite(rawRef) && rawRef > 0 ? rawRef : 1;
  const rawAmt = budget.amountMicros != null ? Number(budget.amountMicros) : null;
  const amount_micros = rawAmt != null && Number.isFinite(rawAmt) ? rawAmt : null;
  return {
    explicitly_shared,
    reference_count,
    budget_editable: isGoogleBudgetEditable(explicitly_shared, reference_count),
    amount_micros,
  };
}

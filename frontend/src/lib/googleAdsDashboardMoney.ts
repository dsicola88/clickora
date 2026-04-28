/**
 * Formata valores monetários do dashboard Google Ads (`metrics.cost_micros`).
 * O Google Ads reporta sempre na moeda da conta — `currency_code` ISO 4217 da API (`customer.currency_code`).
 */
export function formatGoogleAdsDashboardMoney(amount: number, currencyCode?: string | null): string {
  const code =
    currencyCode &&
    typeof currencyCode === "string" &&
    /^[A-Z]{3}$/i.test(currencyCode.trim())
      ? currencyCode.trim().toUpperCase()
      : null;
  if (code) {
    try {
      return new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: code,
      }).format(amount);
    } catch {
      return `${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${code}`;
    }
  }
  return amount.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/**
 * Google Ads stores money values as **micros**: 1 unit of currency = 1,000,000 micros.
 * So $1.50 = 1_500_000 micros, $50/day = 50_000_000 micros.
 * All `*_micros` fields in the database follow this convention so we never lose precision.
 */

export const MICROS_PER_UNIT = 1_000_000;

export function microsToDollars(micros: number | null | undefined): number {
  if (micros === null || micros === undefined) return 0;
  return Number(micros) / MICROS_PER_UNIT;
}

export function dollarsToMicros(dollars: number): number {
  return Math.round(dollars * MICROS_PER_UNIT);
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMicrosUsd(micros: number | null | undefined, compact = false): string {
  const dollars = microsToDollars(micros);
  return compact ? usdCompact.format(dollars) : usdFormatter.format(dollars);
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "just now";
  if (abs < 3600) return `${Math.round(abs / 60)}m ago`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h ago`;
  if (abs < 604800) return `${Math.round(abs / 86400)}d ago`;
  return d.toLocaleDateString();
}

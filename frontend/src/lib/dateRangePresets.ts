import {
  addDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

const ALL_TIME_START = "2000-01-01";

/** Data local YYYY-MM-DD (sem UTC). */
export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return startOfDay(new Date(y, m - 1, d));
}

export function daysInclusive(from: string, to: string): number {
  const a = fromYmd(from);
  const b = fromYmd(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/** Período anterior com a mesma duração, imediatamente antes de `from`. */
export function previousPeriodOfSameLength(from: string, to: string): { from: string; to: string } {
  const n = daysInclusive(from, to);
  if (n < 1) {
    return { from, to };
  }
  const endC = subDays(fromYmd(from), 1);
  const startC = addDays(endC, -(n - 1));
  return { from: toYmd(startC), to: toYmd(endC) };
}

export function rangeToday(): { from: string; to: string } {
  const t = startOfDay(new Date());
  const y = toYmd(t);
  return { from: y, to: y };
}

export function rangeYesterday(): { from: string; to: string } {
  const y = toYmd(subDays(startOfDay(new Date()), 1));
  return { from: y, to: y };
}

/** Domingo 00:00 desta semana (calendário local) até hoje. */
export function rangeThisWeekSunToToday(): { from: string; to: string } {
  const t = startOfDay(new Date());
  const sun = startOfWeek(t, { weekStartsOn: 0 });
  return { from: toYmd(sun), to: toYmd(t) };
}

/** Últimos N dias incluindo hoje (ex.: 7 → hoje e 6 dias anteriores). */
export function rangeLastNDaysThroughToday(n: number): { from: string; to: string } {
  const k = Math.max(1, Math.floor(n));
  const t = startOfDay(new Date());
  return { from: toYmd(addDays(t, -(k - 1))), to: toYmd(t) };
}

export function rangeLast7Days(): { from: string; to: string } {
  return rangeLastNDaysThroughToday(7);
}

export function rangeLast14Days(): { from: string; to: string } {
  return rangeLastNDaysThroughToday(14);
}

export function rangeLast30Days(): { from: string; to: string } {
  return rangeLastNDaysThroughToday(30);
}

/** Semana de calendário completa anterior: domingo a sábado. */
export function rangeLastFullWeekSunSat(): { from: string; to: string } {
  const t = startOfDay(new Date());
  const thisSun = startOfWeek(t, { weekStartsOn: 0 });
  const lastSun = addDays(thisSun, -7);
  const lastSat = addDays(lastSun, 6);
  return { from: toYmd(lastSun), to: toYmd(lastSat) };
}

/** N dias com termino em ontem (incluindo ontem). */
export function rangeLastNDaysThroughYesterday(n: number): { from: string; to: string } {
  const k = Math.max(1, Math.floor(n));
  const y = subDays(startOfDay(new Date()), 1);
  return { from: toYmd(addDays(y, -(k - 1))), to: toYmd(y) };
}

export function rangeThisMonthToToday(): { from: string; to: string } {
  const t = startOfDay(new Date());
  const first = startOfMonth(t);
  return { from: toYmd(first), to: toYmd(t) };
}

export function rangeLastMonth(): { from: string; to: string } {
  const t = startOfDay(new Date());
  const firstThis = startOfMonth(t);
  const lastDayPrev = subDays(firstThis, 1);
  const firstPrev = startOfMonth(lastDayPrev);
  return { from: toYmd(firstPrev), to: toYmd(lastDayPrev) };
}

export function rangeAllTimeToToday(): { from: string; to: string } {
  return { from: ALL_TIME_START, to: toYmd(startOfDay(new Date())) };
}

export type PresetId =
  | "custom"
  | "today"
  | "yesterday"
  | "this_week_sun_today"
  | "last_7"
  | "last_week_sun_sat"
  | "last_14"
  | "this_month"
  | "last_30"
  | "last_month"
  | "all_time"
  | "rolling_until_today"
  | "rolling_until_yesterday";

export const PRESET_LABELS: Record<Exclude<PresetId, "custom" | "rolling_until_today" | "rolling_until_yesterday">, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  this_week_sun_today: "Esta semana (dom. até hoje)",
  last_7: "7 dias atrás",
  last_week_sun_sat: "Semana passada (de dom. a sáb.)",
  last_14: "14 dias atrás",
  this_month: "Este mês",
  last_30: "30 dias atrás",
  last_month: "Mês passado",
  all_time: "Todo o período",
};

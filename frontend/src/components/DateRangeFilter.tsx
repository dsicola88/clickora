import { useCallback, useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import { format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  fromYmd,
  PRESET_LABELS,
  previousPeriodOfSameLength,
  rangeAllTimeToToday,
  rangeLast14Days,
  rangeLast30Days,
  rangeLast7Days,
  rangeLastFullWeekSunSat,
  rangeLastMonth,
  rangeLastNDaysThroughToday,
  rangeLastNDaysThroughYesterday,
  rangeThisMonthToToday,
  rangeThisWeekSunToToday,
  rangeToday,
  rangeYesterday,
  toYmd,
  type PresetId,
} from "@/lib/dateRangePresets";

type Mode =
  | "custom"
  | "rolling_today"
  | "rolling_yesterday"
  | Exclude<PresetId, "custom" | "rolling_until_today" | "rolling_until_yesterday">;

function formatBr(ymd: string): string {
  if (!ymd || ymd.length < 8) return "—";
  const d = fromYmd(ymd);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

type ApplyPayload = { from: string; to: string; compare?: { from: string; to: string } };

export type DateRangeFilterProps = {
  from: string;
  to: string;
  onApply: (p: ApplyPayload) => void;
  /** Exibe o interruptor "Comparar" (período anterior, mesma duração). O callback pode ignorar `compare` se a página não suportar. */
  showCompare?: boolean;
  /** `inverted` — fundo escuro (ex.: cartão de Vendas). */
  variant?: "default" | "inverted";
  className?: string;
  triggerClassName?: string;
};

export function DateRangeFilter({
  from,
  to,
  onApply,
  showCompare = true,
  variant = "default",
  className,
  triggerClassName,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [mode, setMode] = useState<Mode>("custom");
  const [rollingNToToday, setRollingNToToday] = useState(30);
  const [rollingNToYest, setRollingNToYest] = useState(30);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    setMode("custom");
    setCompare(false);
  }, [open, from, to]);

  const calendarValue: DateRange | undefined = (() => {
    if (!draftFrom) return undefined;
    const f = fromYmd(draftFrom);
    if (Number.isNaN(f.getTime())) return undefined;
    if (!draftTo) return { from: f, to: undefined };
    const t = fromYmd(draftTo);
    if (Number.isNaN(t.getTime())) return { from: f, to: undefined };
    return { from: f, to: t };
  })();

  const defaultMonth = calendarValue?.from ?? new Date();
  const todayYmd = toYmd(new Date());
  const fromInputMax = draftTo ? (draftTo < todayYmd ? draftTo : todayYmd) : todayYmd;

  const handleCalendarSelect = (r: DateRange | undefined) => {
    setMode("custom");
    if (!r?.from) {
      setDraftFrom("");
      setDraftTo("");
      return;
    }
    setDraftFrom(toYmd(r.from));
    if (r.to) {
      setDraftTo(toYmd(r.to));
    } else {
      setDraftTo("");
    }
  };

  const commit = useCallback(
    (a: string, b: string) => {
      if (!a || !b) {
        toast.error("Selecione data de início e de fim.");
        return;
      }
      if (fromYmd(a) > fromYmd(b)) {
        toast.error("A data de início não pode ser depois da data de fim.");
        return;
      }
      const payload: ApplyPayload = { from: a, to: b };
      if (compare) {
        payload.compare = previousPeriodOfSameLength(a, b);
      }
      onApply(payload);
      setOpen(false);
    },
    [compare, onApply],
  );

  const applyPreset = (get: () => { from: string; to: string }, m: Mode) => {
    const { from: a, to: b } = get();
    setDraftFrom(a);
    setDraftTo(b);
    setMode(m);
    commit(a, b);
  };

  const presetItem = (opts: { label: string; m: Mode; onClick: () => void; subArrow?: boolean; disabled?: boolean }) => (
    <button
      type="button"
      disabled={opts.disabled}
      onClick={opts.onClick}
      className={cn(
        "flex w-full items-center justify-between gap-1 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        mode === opts.m && open
          ? "bg-primary/12 font-medium text-foreground"
          : "text-foreground/90 hover:bg-muted/80",
        opts.disabled && "pointer-events-none opacity-40",
      )}
    >
      <span className="leading-tight">{opts.label}</span>
      {opts.subArrow ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-45" /> : null}
    </button>
  );

  const onRollingTodayChange = (n: number) => {
    const k = Math.min(365, Math.max(1, n));
    setRollingNToToday(k);
    const r = rangeLastNDaysThroughToday(k);
    setDraftFrom(r.from);
    setDraftTo(r.to);
    setMode("rolling_today");
  };

  const onRollingYesterdayChange = (n: number) => {
    const k = Math.min(365, Math.max(1, n));
    setRollingNToYest(k);
    const r = rangeLastNDaysThroughYesterday(k);
    setDraftFrom(r.from);
    setDraftTo(r.to);
    setMode("rolling_yesterday");
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full min-w-[200px] max-w-md justify-start gap-2 font-normal",
              variant === "inverted" &&
                "border-background/30 bg-background/10 text-background hover:bg-background/15 hover:text-background",
              triggerClassName,
            )}
            aria-label="Selecionar intervalo de datas"
          >
            <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate text-left text-sm">
              {formatBr(from)} – {formatBr(to)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(100vw-1rem,720px)] max-w-[720px] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex max-h-[min(90vh,560px)] flex-col sm:max-h-[min(90vh,520px)] sm:flex-row">
            <div className="flex max-h-[45vh] min-w-0 flex-col border-b border-border sm:max-h-none sm:w-[min(100%,250px)] sm:border-b-0 sm:border-r sm:border-border">
              <ScrollArea className="h-full max-h-[40vh] sm:max-h-[min(80vh,480px)]">
                <div className="min-w-0 space-y-0.5 p-2 pr-1">
                  <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período</p>
                  {presetItem({
                    label: "Personalizar",
                    m: "custom",
                    onClick: () => setMode("custom"),
                    subArrow: false,
                  })}
                  {presetItem({
                    label: PRESET_LABELS.today,
                    m: "today",
                    onClick: () => applyPreset(rangeToday, "today"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.yesterday,
                    m: "yesterday",
                    onClick: () => applyPreset(rangeYesterday, "yesterday"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.this_week_sun_today,
                    m: "this_week_sun_today",
                    onClick: () => applyPreset(rangeThisWeekSunToToday, "this_week_sun_today"),
                    subArrow: true,
                  })}
                  {presetItem({
                    label: PRESET_LABELS.last_7,
                    m: "last_7",
                    onClick: () => applyPreset(rangeLast7Days, "last_7"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.last_week_sun_sat,
                    m: "last_week_sun_sat",
                    onClick: () => applyPreset(rangeLastFullWeekSunSat, "last_week_sun_sat"),
                    subArrow: true,
                  })}
                  {presetItem({
                    label: PRESET_LABELS.last_14,
                    m: "last_14",
                    onClick: () => applyPreset(rangeLast14Days, "last_14"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.this_month,
                    m: "this_month",
                    onClick: () => applyPreset(rangeThisMonthToToday, "this_month"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.last_30,
                    m: "last_30",
                    onClick: () => applyPreset(rangeLast30Days, "last_30"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.last_month,
                    m: "last_month",
                    onClick: () => applyPreset(rangeLastMonth, "last_month"),
                  })}
                  {presetItem({
                    label: PRESET_LABELS.all_time,
                    m: "all_time",
                    onClick: () => applyPreset(rangeAllTimeToToday, "all_time"),
                  })}

                  <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5 px-1">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        className="h-8 w-14 px-1 text-center text-sm"
                        value={rollingNToToday}
                        onChange={(e) => onRollingTodayChange(Number(e.target.value) || 1)}
                        aria-label="Dias até hoje"
                      />
                      <span className="text-xs text-muted-foreground">dias até hoje</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 px-1">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        className="h-8 w-14 px-1 text-center text-sm"
                        value={rollingNToYest}
                        onChange={(e) => onRollingYesterdayChange(Number(e.target.value) || 1)}
                        aria-label="Dias até ontem"
                      />
                      <span className="text-xs text-muted-foreground">dias até ontem</span>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {showCompare ? (
                <div className="mt-auto space-y-1.5 border-t border-border/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="date-compare" className="text-xs font-normal text-muted-foreground">
                      Comparar
                    </Label>
                    <Switch id="date-compare" checked={compare} onCheckedChange={setCompare} />
                  </div>
                  {compare ? (
                    <p className="px-0.5 text-[10px] leading-snug text-muted-foreground">
                      Ao aplicar, incluímos o período anterior de mesma duração (útil em relatórios futuros).
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data de início</Label>
                  <Input
                    type="date"
                    value={draftFrom}
                    min="2000-01-01"
                    max={fromInputMax}
                    onChange={(e) => {
                      setMode("custom");
                      setDraftFrom(e.target.value);
                    }}
                    className="h-9 w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data de fim</Label>
                  <Input
                    type="date"
                    value={draftTo}
                    min={draftFrom}
                    max={toYmd(new Date())}
                    onChange={(e) => {
                      setMode("custom");
                      setDraftTo(e.target.value);
                    }}
                    className="h-9 w-full"
                  />
                </div>
              </div>

              <div className="px-1 pb-1">
                <Calendar
                  mode="range"
                  weekStartsOn={0}
                  locale={ptBR}
                  numberOfMonths={1}
                  selected={calendarValue}
                  onSelect={handleCalendarSelect}
                  defaultMonth={defaultMonth}
                  fromDate={new Date(2000, 0, 1)}
                  toDate={new Date()}
                  disabled={(d) => startOfDay(d) > startOfDay(new Date())}
                  className="w-full p-0"
                />
              </div>

              <div className="mt-auto flex justify-end gap-2 border-t border-border/60 p-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={() => commit(draftFrom, draftTo)} className="gradient-primary">
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

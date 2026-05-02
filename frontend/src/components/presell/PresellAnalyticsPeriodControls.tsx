import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Label } from "@/components/ui/label";
import { PRESET_LABELS, rangeLast7Days, rangeLastMonth, rangeToday } from "@/lib/dateRangePresets";
import { cn } from "@/lib/utils";

function matchesRange(from: string, to: string, preset: () => { from: string; to: string }) {
  try {
    const r = preset();
    return r.from === from && r.to === to;
  } catch {
    return false;
  }
}

type PresellAnalyticsPeriodControlsProps = {
  from: string;
  to: string;
  onApply: (p: { from: string; to: string }) => void;
  className?: string;
  /** Omite o texto de ajuda (evita repetir no segundo cartão). */
  showHint?: boolean;
};

/** Atalhos Hoje / 7 dias / Mês passado + `DateRangeFilter` (calendário e mais presets). */
export function PresellAnalyticsPeriodControls({
  from,
  to,
  onApply,
  className,
  showHint = true,
}: PresellAnalyticsPeriodControlsProps) {
  const chip = (label: string, preset: () => { from: string; to: string }) => {
    const active = matchesRange(from, to, preset);
    return (
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        className={cn(
          "h-9 shrink-0",
          active && "border-0 gradient-primary text-primary-foreground shadow-sm hover:opacity-90",
        )}
        onClick={() => onApply(preset())}
      >
        {label}
      </Button>
    );
  };

  return (
    <div className={cn("w-full min-w-0 space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">Período</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          {chip(PRESET_LABELS.today, rangeToday)}
          {chip(PRESET_LABELS.last_7, rangeLast7Days)}
          {chip(PRESET_LABELS.last_month, rangeLastMonth)}
        </div>
        <DateRangeFilter
          from={from}
          to={to}
          onApply={(p) => onApply({ from: p.from, to: p.to })}
          showCompare={false}
          className="w-full sm:w-auto sm:min-w-[220px] sm:max-w-md lg:max-w-lg"
          triggerClassName="h-9"
        />
      </div>
      {showHint ? (
        <p className="text-[10px] text-muted-foreground leading-snug">
          O botão com datas abre o calendário e outros intervalos (personalizar, últimos N dias, etc.).
        </p>
      ) : null}
    </div>
  );
}

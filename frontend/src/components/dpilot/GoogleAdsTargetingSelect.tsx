import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TargetingOption } from "@/lib/googleAdsTargeting";

type Props = {
  options: TargetingOption[];
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  hint?: string;
  searchPlaceholder: string;
  emptyText: string;
  max: number;
  /** Comparador de código com options (país ISO maiúsc.; idioma minúsc.) */
  normalizeSelected: (code: string) => string;
  matchesOption: (selectedCode: string, optionCode: string) => boolean;
};

export function TargetingMultiSelect({
  options,
  value,
  onChange,
  label,
  hint,
  searchPlaceholder,
  emptyText,
  max,
  normalizeSelected,
  matchesOption,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [normalizeSelected(o.code), o.label]));
    return value.map((c) => ({
      code: c,
      label: map.get(normalizeSelected(c)) ?? c,
    }));
  }, [options, value, normalizeSelected]);

  function toggle(optionCode: string) {
    const n = normalizeSelected(optionCode);
    const idx = value.findIndex((v) => matchesOption(v, optionCode));
    if (idx >= 0) {
      onChange(value.filter((_, i) => i !== idx));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, optionCode]);
  }

  function remove(code: string) {
    onChange(value.filter((v) => v !== code));
  }

  const summary =
    selectedLabels.length === 0
      ? "Seleccionar…"
      : selectedLabels.length <= 2
        ? selectedLabels.map((s) => s.label).join(", ")
        : `${selectedLabels.length} seleccionados`;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal"
          >
            <span className="line-clamp-2 text-sm">{summary}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,380px)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const selected = value.some((v) => matchesOption(v, opt.code));
                  return (
                    <CommandItem
                      key={opt.code}
                      value={`${opt.label} ${opt.code}`}
                      onSelect={() => toggle(opt.code)}
                    >
                      <Check className={cn("mr-2 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{opt.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{opt.code}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedLabels.map((s) => (
            <Badge key={s.code} variant="secondary" className="gap-1 pr-1 font-normal">
              <span>{s.label}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Remover ${s.label}`}
                onClick={() => remove(s.code)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {hint ? <span>{hint}</span> : null}
        <span>Máx. {max}</span>
      </div>
    </div>
  );
}

export function GoogleAdsCountriesSelect(props: Omit<Props, "normalizeSelected" | "matchesOption">) {
  return (
    <TargetingMultiSelect
      {...props}
      normalizeSelected={(c) => c.toUpperCase()}
      matchesOption={(v, opt) => v.toUpperCase() === opt.toUpperCase()}
    />
  );
}

export function GoogleAdsLanguagesSelect(props: Omit<Props, "normalizeSelected" | "matchesOption">) {
  return (
    <TargetingMultiSelect
      {...props}
      normalizeSelected={(c) => c.toLowerCase()}
      matchesOption={(v, opt) => v.toLowerCase() === opt.toLowerCase()}
    />
  );
}

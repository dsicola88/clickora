import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getPresellTypeOption, PRESELL_TYPE_GROUPS } from "@/lib/presellTypeOptions";

type Props = {
  value: string;
  onValueChange: (id: string) => void;
  id?: string;
  disabled?: boolean;
};

export function PresellTypeCombobox({ value, onValueChange, id, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const selected = getPresellTypeOption(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-11 w-full max-w-xl justify-between gap-2 py-2.5 px-3 font-normal text-left shadow-sm"
        >
          <span className="line-clamp-2 min-w-0 flex-1 text-left text-sm leading-snug">
            {selected ? (
              <>
                <span className="font-medium text-foreground">{selected.name}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground line-clamp-2">
                  {selected.description}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Escolher tipo de presell…</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),28rem)] p-0"
        align="start"
        sideOffset={6}
        onWheel={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Pesquisar: VSL, cookies, desconto, idade…" className="h-11" />
          <CommandList className="max-h-[min(22rem,60vh)]">
            <CommandEmpty>Nenhum tipo corresponde à pesquisa.</CommandEmpty>
            {PRESELL_TYPE_GROUPS.map((group) => (
              <CommandGroup key={group.id} heading={group.label}>
                {group.types.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    keywords={[t.name, t.description, group.label, ...(group.hint ? [group.hint] : [])]}
                    onSelect={(current) => {
                      onValueChange(current);
                      setOpen(false);
                    }}
                    className="cursor-pointer items-start gap-2 py-2.5 aria-selected:bg-accent"
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === t.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium leading-snug text-foreground">{t.name}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { Fragment } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { AdNetworkTokenSection } from "@/lib/adNetworkDynamicTokens";

type Props = {
  sections: AdNetworkTokenSection[];
  onSelect: (token: string) => void;
  searchPlaceholder?: string;
  /** Altura máxima da lista pesquisável */
  listMaxHeightClass?: string;
};

export function AdNetworkTokensPickerPanel({
  sections,
  onSelect,
  searchPlaceholder = "Pesquisar (ex.: keyword, gclid, campanha Meta)…",
  listMaxHeightClass = "max-h-[min(56vh,380px)]",
}: Props) {
  return (
    <Command className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden shadow-sm">
      <CommandInput placeholder={searchPlaceholder} className="h-11 border-b border-border/60" />
      <CommandList className={listMaxHeightClass}>
        <CommandEmpty className="py-8 text-sm text-muted-foreground">Nada encontrado — tente outra palavra.</CommandEmpty>
        {sections.map((section, si) => (
          <Fragment key={section.id}>
            {si > 0 ? <CommandSeparator className="my-1" /> : null}
            <CommandGroup
              heading={section.title}
              className="px-1 py-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-foreground [&_[cmdk-group-heading]]:leading-snug [&_[cmdk-group-heading]]:normal-case [&_[cmdk-group-heading]]:tracking-normal"
            >
              {section.items.map((item) => (
                <CommandItem
                  key={`${section.id}-${item.token}`}
                  value={`${section.title} ${item.label} ${item.search} ${item.token}`}
                  onSelect={() => onSelect(item.token)}
                  className="cursor-pointer rounded-md mx-1 my-0.5 px-3 py-2.5 aria-selected:bg-accent"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 text-left">
                    <span className="text-sm font-medium text-foreground leading-tight">{item.label}</span>
                    <span className="text-[11px] font-mono text-muted-foreground truncate">{item.token}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Fragment>
        ))}
      </CommandList>
    </Command>
  );
}

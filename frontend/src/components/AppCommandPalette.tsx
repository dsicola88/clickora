import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  APP_NAV_GROUP_LABEL,
  appNavSearchValue,
  commandNavItems,
  normalizeNavSearchText,
  type AppNavItem,
} from "@/lib/appNav";
import { cn } from "@/lib/utils";

const GROUP_ORDER: AppNavItem["group"][] = [
  "principal",
  "trabalho",
  "performance",
  "configuracao",
  "conta",
  "avancado",
];

function useIsMacShortcut(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

type Props = {
  className?: string;
};

/**
 * Pesquisa global de navegação — botão no topo + ⌘K / Ctrl+K.
 */
export function AppCommandPalette({ className }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const staff = isAdmin || isSuperAdmin;
  const mac = useIsMacShortcut();

  const items = useMemo(() => commandNavItems(staff), [staff]);

  const grouped = useMemo(() => {
    const map = new Map<AppNavItem["group"], AppNavItem[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const item of items) {
      map.get(item.group)?.push(item);
    }
    return GROUP_ORDER.map((g) => ({ group: g, items: map.get(g) ?? [] })).filter(
      (g) => g.items.length > 0,
    );
  }, [items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      // Não disparar com Alt (ex. Ctrl+Alt+K de extensões) nem Shift exclusivo.
      if (e.altKey) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (url: string) => {
      setOpen(false);
      navigate(url);
    },
    [navigate],
  );

  const filter = useCallback((value: string, search: string, keywords?: string[]) => {
    const q = normalizeNavSearchText(search);
    if (!q) return 1;
    const hay = normalizeNavSearchText([value, ...(keywords ?? [])].join(" "));
    return hay.includes(q) ? 1 : 0;
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pesquisar páginas e opções"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "group flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border/80 bg-muted/50 px-2.5 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Pesquisar páginas…</span>
        <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <span className="text-[11px] leading-none">{mac ? "⌘" : "Ctrl"}</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg top-[18%] translate-y-0 gap-0 sm:max-w-lg [&>button]:hidden">
          <DialogTitle className="sr-only">Pesquisar páginas e opções</DialogTitle>
          {/* key força reset do filtro ao reabrir */}
          <Command
            key={open ? "open" : "closed"}
            loop
            filter={filter}
            className="rounded-lg [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput placeholder="Ir para… (presells, postback, google ads, rotadores…)" />
            <CommandList className="max-h-[min(420px,70vh)]">
              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
              {grouped.map(({ group, items: rows }) => (
                <CommandGroup key={group} heading={APP_NAV_GROUP_LABEL[group]}>
                  {rows.map((item) => (
                    <CommandItem
                      key={item.url}
                      value={appNavSearchValue(item)}
                      keywords={item.keywords}
                      onSelect={() => go(item.url)}
                      className="cursor-pointer gap-2.5"
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                      <span className="ml-auto hidden max-w-[40%] truncate text-[11px] text-muted-foreground/70 sm:inline">
                        {item.url}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

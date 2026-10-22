import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/contexts/AuthContext";
import {
  APP_NAV_GROUP_LABEL,
  APP_NAV_ITEMS,
  appNavSearchValue,
  type AppNavItem,
} from "@/lib/appNav";
import { cn } from "@/lib/utils";

const GROUP_ORDER: AppNavItem["group"][] = [
  "principal",
  "trabalho",
  "performance",
  "configuracao",
  "conta",
];

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

type Props = {
  /** Classe extra no botão do header */
  className?: string;
};

/**
 * Pesquisa global de navegação — botão no topo + ⌘K / Ctrl+K (padrão Linear / Vercel).
 */
export function AppCommandPalette({ className }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const staff = isAdmin || isSuperAdmin;
  const mac = isMacPlatform();

  const items = useMemo(
    () => APP_NAV_ITEMS.filter((item) => (item.staffOnly ? staff : true)),
    [staff],
  );

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
      if (e.key.toLowerCase() !== "k") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) {
        // Ainda permite ⌘K em campos — padrão apps SaaS; não bloquear.
      }
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground md:max-w-md md:flex-none md:w-72 lg:w-80",
          className,
        )}
        aria-label="Pesquisar páginas e opções"
      >
        <Search className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Pesquisar páginas…</span>
        <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <span className="text-[11px] leading-none">{mac ? "⌘" : "Ctrl"}</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Ir para… (presells, postback, google ads…)" />
        <CommandList>
          <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
          {grouped.map(({ group, items: rows }) => (
            <CommandGroup key={group} heading={APP_NAV_GROUP_LABEL[group]}>
              {rows.map((item) => (
                <CommandItem
                  key={item.url}
                  value={appNavSearchValue(item)}
                  onSelect={() => go(item.url)}
                  className="gap-2.5"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.title}</span>
                  <span className="ml-auto hidden truncate text-[11px] text-muted-foreground/70 sm:inline">
                    {item.url}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

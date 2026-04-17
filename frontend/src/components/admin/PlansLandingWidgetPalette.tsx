import { useState } from "react";
import { ImageIcon, LayoutGrid, Search, Type, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type LandingWidgetKind = "video" | "image" | "rich_text";

type Props = {
  onAddWidget: (kind: LandingWidgetKind) => void;
  className?: string;
};

export function PlansLandingWidgetPalette({ onAddWidget, className }: Props) {
  const [query, setQuery] = useState("");
  const [basicOpen, setBasicOpen] = useState(true);

  type WDef = {
    kind: LandingWidgetKind;
    label: string;
    description: string;
    icon: typeof Video;
    keywords: string[];
  };

  const widgets: WDef[] = [
    {
      kind: "video",
      label: "Vídeo",
      description: "YouTube, Vimeo ou .mp4 / .webm",
      icon: Video,
      keywords: ["vídeo", "video", "youtube", "vimeo", "embed", "media"],
    },
    {
      kind: "image",
      label: "Imagem",
      description: "URL ou carregar do PC",
      icon: ImageIcon,
      keywords: ["imagem", "image", "foto", "picture", "png", "jpg", "webp"],
    },
    {
      kind: "rich_text",
      label: "Texto (Markdown)",
      description: "Parágrafos, listas e ligações",
      icon: Type,
      keywords: ["texto", "markdown", "editor", "parágrafo", "conteúdo"],
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? widgets.filter(
        (w) =>
          w.label.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.keywords.some((k) => k.includes(q)),
      )
    : widgets;

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-border/70 bg-muted/15 shadow-sm",
        className,
      )}
    >
      <div className="border-b border-border/60 bg-background/80 px-3 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Elementos</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Clique para adicionar ao fim da lista. Reordene os blocos à direita pelo ícone de grelha.
        </p>
        <Tabs defaultValue="widgets" className="mt-3">
          <TabsList className="grid h-9 w-full grid-cols-2">
            <TabsTrigger value="widgets" className="text-xs">
              Widgets
            </TabsTrigger>
            <TabsTrigger value="globals" className="text-xs" disabled>
              Globais
            </TabsTrigger>
          </TabsList>
          <TabsContent value="widgets" className="mt-3 space-y-2 outline-none">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar widget…"
                className="h-9 pl-8 text-xs"
                aria-label="Pesquisar widgets"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ScrollArea className="min-h-[200px] max-h-[min(520px,calc(100vh-220px))] flex-1">
        <div className="space-y-2 p-3">
          <Collapsible open={basicOpen} onOpenChange={setBasicOpen}>
            <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-transparent px-2 py-2 text-left hover:bg-muted/40">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Básico
              </span>
              <span className="text-[10px] text-muted-foreground">{basicOpen ? "−" : "+"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhum resultado.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((w) => {
                    const Icon = w.icon;
                    return (
                      <button
                        key={w.kind}
                        type="button"
                        onClick={() => onAddWidget(w.kind)}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-lg border border-border/70 bg-background/90 p-3 text-left",
                          "transition-colors hover:border-primary/35 hover:bg-primary/5",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        )}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/60 text-foreground">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        </span>
                        <span className="text-xs font-medium leading-tight text-foreground">{w.label}</span>
                        <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                          {w.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </aside>
  );
}

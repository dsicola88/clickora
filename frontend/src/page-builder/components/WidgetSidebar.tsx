import { useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { WIDGET_CATEGORIES, WIDGET_LIST, type WidgetDefinition } from "../widget-registry";
import { useBuilder } from "../store";
import { Search } from "lucide-react";

export function WidgetSidebar() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof WIDGET_CATEGORIES)[number]["id"]>("basic");
  const insertPaletteWidget = useBuilder((s) => s.insertPaletteWidget);
  const filtered = WIDGET_LIST.filter((w) => {
    const matchesQuery = !query || w.label.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = query ? true : w.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-editor-border bg-editor-panel text-editor-fg">
      <div className="border-b border-editor-border p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
          Elementos
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-editor-fg-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar elemento…"
            className="h-8 w-full rounded-md border border-editor-border bg-editor-bg pl-8 pr-2 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent"
          />
        </div>
        {!query ? (
          <div className="mt-2 grid grid-cols-4 gap-1">
            {WIDGET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`h-7 truncate rounded-md px-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                  category === cat.id
                    ? "bg-editor-accent text-editor-accent-fg"
                    : "bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
                }`}
              >
                {cat.id === "advanced" ? "Extra" : cat.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[10px] leading-snug text-editor-fg-muted">
          Clique para inserir na seleção, ou arraste para uma coluna.
        </p>
      </div>

      <div className="editor-scrollbar flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((w) => (
            <DraggableWidget key={w.type} def={w} onInsert={() => insertPaletteWidget(w.type)} />
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-editor-fg-muted">Nenhum elemento.</p>
        ) : null}
      </div>
    </aside>
  );
}

function DraggableWidget({ def, onInsert }: { def: WidgetDefinition; onInsert: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${def.type}`,
    data: { source: "palette", widgetType: def.type },
  });
  const origin = useRef({ x: 0, y: 0 });
  const Icon = def.icon;
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        origin.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onClick={(e) => {
        const dx = Math.abs(e.clientX - origin.current.x);
        const dy = Math.abs(e.clientY - origin.current.y);
        if (dx < 5 && dy < 5) onInsert();
      }}
      className={`flex cursor-grab flex-col items-center justify-center gap-1.5 rounded-md border border-editor-border bg-editor-panel-2 px-2 py-3 text-editor-fg-muted transition-colors hover:border-editor-accent hover:bg-editor-bg hover:text-editor-fg active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center text-[11px] font-medium leading-tight">{def.label}</span>
    </button>
  );
}

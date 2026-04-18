import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { WIDGET_CATEGORIES, WIDGET_LIST, type WidgetDefinition } from "../widget-registry";
import { Search } from "lucide-react";

export function WidgetSidebar() {
  const [query, setQuery] = useState("");
  const filtered = query
    ? WIDGET_LIST.filter((w) => w.label.toLowerCase().includes(query.toLowerCase()))
    : WIDGET_LIST;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-editor-border bg-editor-panel text-editor-fg">
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
            placeholder="Buscar widget..."
            className="h-8 w-full rounded bg-editor-panel-2 pl-8 pr-2 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent"
          />
        </div>
      </div>

      <div className="editor-scrollbar flex-1 overflow-y-auto p-3">
        {WIDGET_CATEGORIES.map((cat) => {
          const items = filtered.filter((w) => w.category === cat.id);
          if (items.length === 0) return null;
          return (
            <div key={cat.id} className="mb-5">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-editor-fg-muted">
                {cat.label}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {items.map((w) => (
                  <DraggableWidget key={w.type} def={w} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function DraggableWidget({ def }: { def: WidgetDefinition }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${def.type}`,
    data: { source: "palette", widgetType: def.type },
  });
  const Icon = def.icon;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab flex-col items-center justify-center gap-1.5 rounded border border-editor-border bg-editor-panel-2 p-3 text-editor-fg-muted transition-all hover:border-editor-accent hover:text-editor-fg active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[11px] font-medium">{def.label}</span>
    </div>
  );
}

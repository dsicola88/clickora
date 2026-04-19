import { useBuilder } from "../store";
import type { SelectionTarget } from "../types";
import { WIDGET_REGISTRY } from "../widget-registry";
import { ListTree } from "lucide-react";

function selectionClasses(active: boolean) {
  return `w-full rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
    active
      ? "bg-editor-accent/20 font-medium text-editor-fg"
      : "text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
  }`;
}

export function StructureNavigator() {
  const doc = useBuilder((s) => s.doc);
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);

  const isSectionSel = (id: string) => selection?.kind === "section" && selection.id === id;
  const isColumnSel = (sectionId: string, columnId: string) =>
    selection?.kind === "column" && selection.sectionId === sectionId && selection.id === columnId;
  const isWidgetSel = (sectionId: string, columnId: string, widgetId: string) =>
    selection?.kind === "widget" &&
    selection.sectionId === sectionId &&
    selection.columnId === columnId &&
    selection.id === widgetId;

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col border-l border-editor-border bg-editor-panel text-editor-fg">
      <div className="flex items-center gap-2 border-b border-editor-border px-3 py-2">
        <ListTree className="h-4 w-4 text-editor-fg-muted" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">Estrutura</h2>
      </div>
      <div className="editor-scrollbar flex-1 overflow-y-auto p-2">
        {doc.sections.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-editor-fg-muted">Sem secções.</p>
        ) : (
          <ul className="space-y-0.5">
            {doc.sections.map((section, si) => (
              <li key={section.id}>
                <button
                  type="button"
                  className={selectionClasses(isSectionSel(section.id))}
                  onClick={() => select({ kind: "section", id: section.id } satisfies SelectionTarget)}
                >
                  Seção {si + 1}
                </button>
                <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-editor-border pl-2">
                  {section.columns.map((column, ci) => (
                    <li key={column.id}>
                      <button
                        type="button"
                        className={selectionClasses(isColumnSel(section.id, column.id))}
                        onClick={() =>
                          select({
                            kind: "column",
                            sectionId: section.id,
                            id: column.id,
                          } satisfies SelectionTarget)
                        }
                      >
                        Coluna {ci + 1}
                      </button>
                      <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-editor-border pl-2">
                        {column.widgets.map((widget) => {
                          const label = WIDGET_REGISTRY[widget.type]?.label ?? widget.type;
                          return (
                            <li key={widget.id}>
                              <button
                                type="button"
                                className={selectionClasses(
                                  isWidgetSel(section.id, column.id, widget.id),
                                )}
                                onClick={() =>
                                  select({
                                    kind: "widget",
                                    sectionId: section.id,
                                    columnId: column.id,
                                    id: widget.id,
                                  } satisfies SelectionTarget)
                                }
                              >
                                {label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

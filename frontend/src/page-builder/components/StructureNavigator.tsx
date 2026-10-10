import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useBuilder } from "../store";
import type { SelectionTarget } from "../types";
import { WIDGET_REGISTRY } from "../widget-registry";
import { readContainerChildren } from "../widget-tree";
import type { WidgetNode } from "../types";
import { GripVertical, ListTree } from "lucide-react";

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
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-editor-border bg-editor-panel text-editor-fg">
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
                        {column.widgets.map((widget, index) => (
                          <WidgetBranch
                            key={widget.id}
                            widget={widget}
                            index={index}
                            sectionId={section.id}
                            columnId={column.id}
                            active={isWidgetSel(section.id, column.id, widget.id)}
                            isWidgetSel={isWidgetSel}
                            onSelect={select}
                          />
                        ))}
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

function WidgetBranch({
  widget,
  index,
  sectionId,
  columnId,
  containerId,
  depth = 0,
  active,
  isWidgetSel,
  onSelect,
}: {
  widget: WidgetNode;
  index: number;
  sectionId: string;
  columnId: string;
  containerId?: string;
  depth?: number;
  active: boolean;
  isWidgetSel: (sectionId: string, columnId: string, widgetId: string) => boolean;
  onSelect: (target: SelectionTarget) => void;
}) {
  const children = readContainerChildren(widget);
  return (
    <li>
      <NavWidget
        label={WIDGET_REGISTRY[widget.type]?.label ?? widget.type}
        active={active}
        sectionId={sectionId}
        columnId={columnId}
        widgetId={widget.id}
        index={index}
        containerId={containerId}
        depth={depth}
        onSelect={() =>
          onSelect({ kind: "widget", sectionId, columnId, id: widget.id } satisfies SelectionTarget)
        }
      />
      {children.length > 0 ? (
        <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-editor-border pl-2">
          {children.map((child, childIndex) => (
            <WidgetBranch
              key={child.id}
              widget={child}
              index={childIndex}
              sectionId={sectionId}
              columnId={columnId}
              containerId={widget.id}
              depth={depth + 1}
              active={isWidgetSel(sectionId, columnId, child.id)}
              isWidgetSel={isWidgetSel}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function NavWidget({
  label,
  active,
  sectionId,
  columnId,
  widgetId,
  index,
  containerId,
  depth,
  onSelect,
}: {
  label: string;
  active: boolean;
  sectionId: string;
  columnId: string;
  widgetId: string;
  index: number;
  containerId?: string;
  depth: number;
  onSelect: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `nav-slot:${widgetId}`,
    data: { kind: "widget-slot", sectionId, columnId, index, containerId, depth },
  });
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: `nav:${widgetId}`,
    data: { source: "canvas-widget", sectionId, columnId, widgetId },
  });

  return (
    <div ref={setDropRef} className={isOver ? "rounded bg-editor-accent/20" : undefined}>
      <button
        type="button"
        ref={setDragRef}
        {...listeners}
        {...attributes}
        className={`${selectionClasses(active)} flex items-center gap-1`}
        onClick={onSelect}
      >
        <GripVertical className="h-3 w-3 shrink-0 opacity-60" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

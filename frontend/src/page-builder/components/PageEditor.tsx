import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BuilderSurfaceProvider } from "../builder-surface";
import { useParams } from "react-router-dom";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useBuilder } from "../store";
import type { WidgetType } from "../types";
import { createWidget } from "../factory";
import { WIDGET_REGISTRY } from "../widget-registry";
import { EditorTopbar } from "./EditorTopbar";
import { WidgetSidebar } from "./WidgetSidebar";
import { Canvas } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { StructureNavigator } from "./StructureNavigator";

/** Separadores entre colunas: linha central, ~11px de área ativa, cursor este/oeste. */
const EDITOR_RESIZE_HANDLE =
  "group relative z-10 flex w-[11px] max-w-[11px] shrink-0 select-none items-stretch justify-center overflow-visible border-0 bg-transparent outline-none transition-colors data-[panel-group-direction=horizontal]:cursor-ew-resize focus-visible:ring-2 focus-visible:ring-editor-accent focus-visible:ring-offset-1 focus-visible:ring-offset-editor-bg before:pointer-events-none before:absolute before:inset-y-1 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:bg-editor-border/95 before:transition-all hover:before:bg-editor-accent/75 hover:before:w-0.5 data-[resize-handle-state=drag]:before:w-1 data-[resize-handle-state=drag]:before:bg-editor-accent";

type PaletteDrag = { source: "palette"; widgetType: WidgetType };
type CanvasDrag = {
  source: "canvas-widget";
  sectionId: string;
  columnId: string;
  widgetId: string;
};
type OverData =
  | { kind: "column"; sectionId: string; columnId: string }
  | { kind: "container"; sectionId: string; columnId: string; containerId: string; depth?: number }
  | { kind: "widget-slot"; sectionId: string; columnId: string; index: number; containerId?: string; depth?: number }
  | { kind: "canvas-empty" };

/** Prefere o widget sob o ponteiro à coluna que o contém. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const pool = hits.length > 0 ? hits : closestCenter(args);
    const score = (id: string | number) => {
    const data = args.droppableContainers.find((c) => c.id === id)?.data.current as
      | { kind?: string; depth?: number }
      | undefined;
    const depth = data?.depth ?? 0;
    if (data?.kind === "widget-slot") return 20 + depth;
    if (data?.kind === "container") return 10 + depth;
    if (data?.kind === "column") return 2;
    if (data?.kind === "canvas-empty") return 1;
    return 0;
  };
  return [...pool].sort((a, b) => score(b.id) - score(a.id));
};

export function PageEditor() {
  const { id: routePresellId } = useParams<{ id?: string }>();
  const panelLayoutAutoSaveId = useMemo(
    () => `clickora-pb-panels:${routePresellId?.trim() || "new"}`,
    [routePresellId],
  );

  const preview = useBuilder((s) => s.preview);
  const structurePanelOpen = useBuilder((s) => s.structurePanelOpen);
  const structurePanelRef = useRef<ImperativePanelHandle>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);

  const syncStructurePanelOpen = useCallback((open: boolean) => {
    useBuilder.setState({ structurePanelOpen: open });
  }, []);

  useLayoutEffect(() => {
    const apply = () => {
      const p = structurePanelRef.current;
      if (!p) return;
      try {
        if (structurePanelOpen) p.expand(12);
        else p.collapse();
      } catch {
        /* painel ainda não disponível */
      }
    };
    apply();
    const raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [structurePanelOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (useBuilder.getState().preview) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const state = useBuilder.getState();
      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (meta && key === "d") {
        event.preventDefault();
        state.duplicateSelection();
        return;
      }
      if (meta && event.shiftKey && key === "c") {
        event.preventDefault();
        state.copyStyle();
        return;
      }
      if (meta && event.shiftKey && key === "v") {
        event.preventDefault();
        state.pasteStyle();
        return;
      }
      if (meta && key === "c") {
        event.preventDefault();
        state.copySelection();
        return;
      }
      if (meta && key === "v") {
        event.preventDefault();
        state.pasteClipboard();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        state.deleteSelection();
        return;
      }
      if (event.key === "Escape") state.select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as PaletteDrag | CanvasDrag | undefined;
    if (!data) {
      setDragLabel(null);
      return;
    }
    if (data.source === "palette") {
      setDragLabel(WIDGET_REGISTRY[data.widgetType]?.label ?? "Elemento");
      return;
    }
    const doc = useBuilder.getState().doc;
    const section = doc.sections.find((s) => s.id === data.sectionId);
    const column = section?.columns.find((c) => c.id === data.columnId);
    const widget = column?.widgets.find((w) => w.id === data.widgetId);
    setDragLabel(widget ? (WIDGET_REGISTRY[widget.type]?.label ?? "Elemento") : "Elemento");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragLabel(null);
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as PaletteDrag | CanvasDrag | undefined;
    const overData = over.data.current as OverData | undefined;
    if (!data || !overData) return;

    const state = useBuilder.getState();

    if (data.source === "palette") {
      const widget = createWidget(data.widgetType);
      if (overData.kind === "canvas-empty" || state.doc.sections.length === 0) {
        const sectionId = state.addSectionLayout([100]);
        const section = useBuilder.getState().doc.sections.find((s) => s.id === sectionId);
        const column = section?.columns[0];
        if (section && column) {
          useBuilder.getState().insertWidgetNode(section.id, column.id, widget);
          useBuilder.getState().select({
            kind: "widget",
            sectionId: section.id,
            columnId: column.id,
            id: widget.id,
          });
        }
        return;
      }
      if (overData.kind === "widget-slot") {
        state.insertWidgetNode(
          overData.sectionId,
          overData.columnId,
          widget,
          overData.index,
          overData.containerId,
        );
        state.select({
          kind: "widget",
          sectionId: overData.sectionId,
          columnId: overData.columnId,
          id: widget.id,
        });
        return;
      }
      if (overData.kind === "container") {
        state.insertWidgetNode(overData.sectionId, overData.columnId, widget, undefined, overData.containerId);
        state.select({
          kind: "widget",
          sectionId: overData.sectionId,
          columnId: overData.columnId,
          id: widget.id,
        });
        return;
      }
      if (overData.kind === "column") {
        state.insertWidgetNode(overData.sectionId, overData.columnId, widget);
        state.select({
          kind: "widget",
          sectionId: overData.sectionId,
          columnId: overData.columnId,
          id: widget.id,
        });
      }
      return;
    }

    if (overData.kind === "canvas-empty") return;
    if (overData.kind !== "column" && overData.kind !== "container" && overData.kind !== "widget-slot") return;

    const from = {
      sectionId: data.sectionId,
      columnId: data.columnId,
      widgetId: data.widgetId,
    };
    const containerId = overData.kind === "column" ? undefined : overData.containerId;
    const index = overData.kind === "widget-slot" ? overData.index : 9999;
    state.moveWidget(from, {
      sectionId: overData.sectionId,
      columnId: overData.columnId,
      index,
      containerId,
    });
  };

  const workspace = preview ? (
    <div className="flex h-full min-h-0 flex-col">
      <EditorTopbar />
      <div className="min-h-0 flex-1 overflow-auto bg-editor-canvas">
        <Canvas />
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-0 flex-col bg-editor-bg">
      <EditorTopbar />
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 min-w-0 flex-1"
        autoSaveId={panelLayoutAutoSaveId}
      >
        <ResizablePanel
          id="page-builder-widgets"
          defaultSize={18}
          minSize={12}
          maxSize={38}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          <WidgetSidebar />
        </ResizablePanel>
        <ResizableHandle
          title="Arrastar para ajustar a largura dos painéis"
          className={EDITOR_RESIZE_HANDLE}
        />
        <ResizablePanel
          id="page-builder-canvas"
          defaultSize={58}
          minSize={32}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          <Canvas />
        </ResizablePanel>
        <ResizableHandle
          title="Arrastar para ajustar a largura dos painéis"
          className={EDITOR_RESIZE_HANDLE}
        />
        <ResizablePanel
          ref={structurePanelRef}
          id="page-builder-structure"
          collapsible
          collapsedSize={0}
          defaultSize={0}
          minSize={10}
          maxSize={28}
          className="min-h-0 min-w-0 overflow-hidden"
          onCollapse={() => syncStructurePanelOpen(false)}
          onExpand={() => syncStructurePanelOpen(true)}
        >
          <StructureNavigator />
        </ResizablePanel>
        <ResizableHandle
          title="Arrastar para ajustar a largura dos painéis"
          className={EDITOR_RESIZE_HANDLE}
        />
        <ResizablePanel
          id="page-builder-properties"
          defaultSize={24}
          minSize={14}
          maxSize={44}
          className="min-h-0 min-w-0 overflow-hidden"
        >
          <PropertyPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );

  return (
    <BuilderSurfaceProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragCancel={() => setDragLabel(null)}
        onDragEnd={handleDragEnd}
      >
        {workspace}
        <DragOverlay dropAnimation={null}>
          {dragLabel ? (
            <div className="rounded-md bg-editor-accent px-3 py-2 text-xs font-semibold text-editor-accent-fg shadow-xl">
              {dragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </BuilderSurfaceProvider>
  );
}

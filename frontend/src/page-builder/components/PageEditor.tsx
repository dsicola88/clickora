import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useBuilder } from "../store";
import type { WidgetType } from "../types";
import { createWidget, createSection } from "../factory";
import { EditorTopbar } from "./EditorTopbar";
import { WidgetSidebar } from "./WidgetSidebar";
import { Canvas } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { StructureNavigator } from "./StructureNavigator";

/** Separadores entre colunas: linha central, ~11px de área ativa, cursor este/oeste. */
const EDITOR_RESIZE_HANDLE =
  "group relative z-10 flex w-[11px] max-w-[11px] shrink-0 select-none items-stretch justify-center overflow-visible border-0 bg-transparent outline-none transition-colors data-[panel-group-direction=horizontal]:cursor-ew-resize focus-visible:ring-2 focus-visible:ring-editor-accent focus-visible:ring-offset-1 focus-visible:ring-offset-editor-bg before:pointer-events-none before:absolute before:inset-y-1 before:left-1/2 before:w-px before:-translate-x-1/2 before:rounded-full before:bg-editor-border/95 before:transition-all hover:before:bg-editor-accent/75 hover:before:w-0.5 data-[resize-handle-state=drag]:before:w-1 data-[resize-handle-state=drag]:before:bg-editor-accent";

export function PageEditor() {
  const { id: routePresellId } = useParams<{ id?: string }>();
  /** Larguras guardadas no localStorage por página (evita misturar presells diferentes). */
  const panelLayoutAutoSaveId = useMemo(
    () => `clickora-pb-panels:${routePresellId?.trim() || "new"}`,
    [routePresellId],
  );

  const preview = useBuilder((s) => s.preview);
  const structurePanelOpen = useBuilder((s) => s.structurePanelOpen);
  const structurePanelRef = useRef<ImperativePanelHandle>(null);

  const syncStructurePanelOpen = useCallback((open: boolean) => {
    useBuilder.setState({ structurePanelOpen: open });
  }, []);

  useLayoutEffect(() => {
    const p = structurePanelRef.current;
    if (!p) return;
    try {
      if (structurePanelOpen) p.expand(12);
      else p.collapse();
    } catch {
      /* painel ainda não disponível */
    }
  }, [structurePanelOpen]);
  const insertWidgetNode = useBuilder((s) => s.insertWidgetNode);
  const addSection = useBuilder((s) => s.addSection);
  const doc = useBuilder((s) => s.doc);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as
      | { source: "palette"; widgetType: WidgetType }
      | undefined;
    const overData = over.data.current as
      | { kind: "column"; sectionId: string; columnId: string }
      | { kind: "canvas-empty" }
      | undefined;
    if (!data || data.source !== "palette") return;

    if (overData?.kind === "canvas-empty" || doc.sections.length === 0) {
      // Create a new section + drop the widget into its first column
      const section = createSection(1);
      const widget = createWidget(data.widgetType);
      section.columns[0].widgets.push(widget);
      // Push via store
      addSection(1);
      // We can't access the just-created section's id easily here without refactor;
      // instead, insert the widget directly using a fresh store call:
      const state = useBuilder.getState();
      const last = state.doc.sections[state.doc.sections.length - 1];
      if (last && last.columns[0]) {
        insertWidgetNode(last.id, last.columns[0].id, widget);
      }
      return;
    }

    if (overData?.kind === "column") {
      const widget = createWidget(data.widgetType);
      insertWidgetNode(overData.sectionId, overData.columnId, widget);
    }
  };

  if (preview) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <EditorTopbar />
        <div className="min-h-0 flex-1 overflow-auto bg-editor-canvas">
          <Canvas />
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
    </DndContext>
  );
}

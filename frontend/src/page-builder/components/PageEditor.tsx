import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useBuilder } from "../store";
import type { WidgetType } from "../types";
import { createWidget, createSection } from "../factory";
import { EditorTopbar } from "./EditorTopbar";
import { WidgetSidebar } from "./WidgetSidebar";
import { Canvas } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { StructureNavigator } from "./StructureNavigator";

export function PageEditor() {
  const preview = useBuilder((s) => s.preview);
  const structurePanelOpen = useBuilder((s) => s.structurePanelOpen);
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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <WidgetSidebar />
          <Canvas />
          {structurePanelOpen ? <StructureNavigator /> : null}
          <PropertyPanel />
        </div>
      </div>
    </DndContext>
  );
}

import { useDroppable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import { useNestedRender } from "../nested-render";
import { stylesToCssWidgetShell } from "../style-utils";
import type { DeviceType, FlexAlign, FlexDirection, FlexJustify, FlexWrapMode, WidgetNode } from "../types";
import { WidgetInlineStyle } from "../widget-custom-css";
import { readContainerChildren } from "../widget-tree";
import { WIDGET_REGISTRY } from "../widget-registry";

export interface ContainerContent {
  direction: FlexDirection;
  justify: FlexJustify;
  align: FlexAlign;
  wrap: FlexWrapMode;
  gap: number;
  widgets: WidgetNode[];
}

export function containerFlexStyle(content: Partial<ContainerContent>): CSSProperties {
  return {
    display: "flex",
    flexDirection: content.direction ?? "row",
    justifyContent: content.justify ?? "flex-start",
    alignItems: content.align ?? "stretch",
    flexWrap: content.wrap ?? "nowrap",
    gap: `${content.gap ?? 16}px`,
    width: "100%",
    minHeight: 0,
  };
}

export function ContainerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const nested = useNestedRender();
  const content = widget.content as Partial<ContainerContent>;
  const children = readContainerChildren(widget);
  if (nested && nested.containerId === widget.id) {
    return <EditorContainer widget={widget} device={device} childrenNodes={children} content={content} />;
  }
  return <PublicContainer device={device} childrenNodes={children} content={content} />;
}

function EditorContainer({
  widget,
  device,
  childrenNodes,
  content,
}: {
  widget: WidgetNode;
  device: DeviceType;
  childrenNodes: WidgetNode[];
  content: Partial<ContainerContent>;
}) {
  const nested = useNestedRender();
  const { setNodeRef, isOver } = useDroppable({
    id: `container:${widget.id}`,
    data: {
      kind: "container",
      sectionId: nested?.sectionId,
      columnId: nested?.columnId,
      containerId: widget.id,
      depth: nested?.depth ?? 1,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        ...containerFlexStyle(content),
        outline: isOver ? "2px solid var(--editor-accent)" : undefined,
        outlineOffset: 2,
        background: childrenNodes.length === 0 ? "rgba(148, 163, 184, 0.08)" : undefined,
      }}
      data-device={device}
    >
      {childrenNodes.length === 0 ? (
        <div className="flex min-h-[72px] w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500">
          Largue elementos neste contentor
        </div>
      ) : (
        childrenNodes.map((child, index) => nested?.render(child, index))
      )}
    </div>
  );
}

function PublicContainer({
  device,
  childrenNodes,
  content,
}: {
  device: DeviceType;
  childrenNodes: WidgetNode[];
  content: Partial<ContainerContent>;
}) {
  return (
    <div style={containerFlexStyle(content)}>
      {childrenNodes.map((child) => {
        const def = WIDGET_REGISTRY[child.type];
        if (!def) return null;
        const shell = stylesToCssWidgetShell(child.styles, device);
        const noShrink = shell.flexShrink === 0;
        return (
          <div
            key={child.id}
            id={child.cssId?.trim() || undefined}
            className={child.cssClasses?.trim() || undefined}
            style={{ ...shell, minWidth: noShrink ? "auto" : 0 }}
          >
            <WidgetInlineStyle widget={child} />
            <def.Render widget={child} device={device} />
          </div>
        );
      })}
    </div>
  );
}

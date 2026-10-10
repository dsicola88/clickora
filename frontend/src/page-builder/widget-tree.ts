import type { WidgetNode } from "./types";

export function readContainerChildren(widget: WidgetNode): WidgetNode[] {
  if (widget.type !== "container") return [];
  const raw = (widget.content as { widgets?: unknown }).widgets;
  return Array.isArray(raw) ? (raw as WidgetNode[]) : [];
}

export function locateWidget(
  widgets: WidgetNode[],
  widgetId: string,
): { list: WidgetNode[]; index: number } | null {
  for (let index = 0; index < widgets.length; index++) {
    if (widgets[index].id === widgetId) return { list: widgets, index };
    const nested = readContainerChildren(widgets[index]);
    if (nested.length === 0 && widgets[index].type !== "container") continue;
    const found = locateWidget(nested, widgetId);
    if (found) return found;
  }
  return null;
}

export function parentContainerId(widgets: WidgetNode[], widgetId: string): string | undefined {
  for (const widget of widgets) {
    const nested = readContainerChildren(widget);
    if (nested.some((child) => child.id === widgetId)) return widget.id;
    const deeper = parentContainerId(nested, widgetId);
    if (deeper) return deeper;
  }
  return undefined;
}

export function widgetContains(widget: WidgetNode, id: string): boolean {
  if (widget.id === id) return true;
  return readContainerChildren(widget).some((child) => widgetContains(child, id));
}

export function reIdWidget(widget: WidgetNode, nextId: (prefix: string) => string): WidgetNode {
  const copy: WidgetNode = {
    ...widget,
    id: nextId("w_"),
    content: { ...widget.content },
    styles: JSON.parse(JSON.stringify(widget.styles)),
  };
  const nested = readContainerChildren(widget);
  if (widget.type === "container") {
    copy.content = {
      ...copy.content,
      widgets: nested.map((child) => reIdWidget(child, nextId)),
    };
  }
  return copy;
}

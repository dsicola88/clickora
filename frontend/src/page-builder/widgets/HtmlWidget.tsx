import type { DeviceType, WidgetNode } from "../types";

export function HtmlWidget({ widget }: { widget: WidgetNode; device: DeviceType }) {
  const code = (widget.content.code as string) ?? "";
  return (
    <div
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}

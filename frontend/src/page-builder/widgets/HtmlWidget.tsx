import type { DeviceType, WidgetNode } from "../types";

export function HtmlWidget({ widget }: { widget: WidgetNode; device: DeviceType }) {
  const code = (widget.content.code as string) ?? "";
  return (
    <div
      // eslint-disable-next-line react/no-danger -- author-controlled HTML widget
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}

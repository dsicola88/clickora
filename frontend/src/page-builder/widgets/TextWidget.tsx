import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export function TextWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const html = (widget.content.html as string) ?? "";
  return (
    <div
      style={stylesToCss(widget.styles, device)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

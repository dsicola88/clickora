import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export function HeadingWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const text = (widget.content.text as string) ?? "";
  const tag = ((widget.content.tag as string) ?? "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const Tag = tag;
  return <Tag style={{ margin: 0, ...stylesToCss(widget.styles, device) }}>{text}</Tag>;
}

import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

export interface MenuAnchorContent {
  /** ID âncora sem # (ex.: oferta). */
  anchorId: string;
}

export function MenuAnchorWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<MenuAnchorContent>;
  const raw = (c.anchorId ?? "ancora").trim().replace(/^#/, "");
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, "-") || "ancora";

  return (
    <div
      id={id}
      data-clickora-menu-anchor={id}
      style={{
        ...stylesToCssWidgetContent(widget.styles, device),
        height: 1,
        width: "100%",
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden
    />
  );
}

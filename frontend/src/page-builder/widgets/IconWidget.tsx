import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import * as Icons from "lucide-react";
import type { ComponentType } from "react";

export function IconWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const name = (widget.content.name as string) ?? "star";
  const size = (widget.content.size as number) ?? 48;
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);

  const compName = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const lookedUp = (Icons as unknown as Record<string, ComponentType<{ size?: number; color?: string }>>)[
    compName
  ];
  const IconComp = lookedUp ?? Icons.Star;

  return (
    <div style={{ display: "flex", justifyContent: alignToFlexJustify(align), ...css }}>
      <IconComp size={size} color={css.color as string | undefined} />
    </div>
  );
}

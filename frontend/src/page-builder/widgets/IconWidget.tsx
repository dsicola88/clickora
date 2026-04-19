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

  // Convert "star" -> "Star" to look up the lucide component
  const compName = name.charAt(0).toUpperCase() + name.slice(1);
  const IconComp =
    ((Icons as unknown as Record<string, ComponentType<{ size?: number; color?: string }>>)[
      compName
    ] as ComponentType<{ size?: number; color?: string }>) ?? Icons.Star;

  return (
    <div style={{ display: "flex", justifyContent: alignToFlexJustify(align), ...css }}>
      <IconComp size={size} color={css.color as string | undefined} />
    </div>
  );
}

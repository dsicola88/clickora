import type { DeviceType, WidgetNode } from "../types";
import { resolveResponsive } from "../store";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";

export function DividerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const weight = (widget.content.weight as number) ?? 1;
  const style = (widget.content.style as string) ?? "solid";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const { color, width, ...rest } = css;
  return (
    <div
      style={{
        ...rest,
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        width: "100%",
      }}
    >
      <hr
        style={{
          borderTop: `${weight}px ${style} ${(color as string) ?? "#e0e0e0"}`,
          borderRight: 0,
          borderBottom: 0,
          borderLeft: 0,
          margin: 0,
          width: (width as string | undefined) ?? "100%",
          maxWidth: "100%",
        }}
      />
    </div>
  );
}

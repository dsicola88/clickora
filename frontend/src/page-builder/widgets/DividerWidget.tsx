import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export function DividerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const weight = (widget.content.weight as number) ?? 1;
  const style = (widget.content.style as string) ?? "solid";
  const css = stylesToCss(widget.styles, device);
  const { color, width, ...rest } = css;
  return (
    <div style={rest}>
      <hr
        style={{
          borderTop: `${weight}px ${style} ${(color as string) ?? "#e0e0e0"}`,
          borderRight: 0,
          borderBottom: 0,
          borderLeft: 0,
          margin: 0,
          width: width as string | undefined,
        }}
      />
    </div>
  );
}

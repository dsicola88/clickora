import type { DeviceType, WidgetNode } from "../types";
import { resolveResponsive } from "../store";

export function SpacerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const height = resolveResponsive(widget.styles.height, device) ?? "50px";
  return <div style={{ width: "100%", height }} aria-hidden />;
}

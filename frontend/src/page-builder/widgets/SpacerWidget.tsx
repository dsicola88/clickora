import type { DeviceType, WidgetNode } from "../types";
import { resolveResponsive } from "../store";
import { stylesToCssWidgetContent } from "../style-utils";

export function SpacerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const height = resolveResponsive(widget.styles.height, device) ?? "50px";
  const css = stylesToCssWidgetContent(widget.styles, device);
  return <div style={{ ...css, width: css.width ?? "100%", height }} aria-hidden />;
}

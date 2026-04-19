import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export function TextWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const html = (widget.content.html as string) ?? "";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        width: "100%",
      }}
    >
      <div style={css} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

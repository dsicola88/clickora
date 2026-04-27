import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export function ImageWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const src = (widget.content.src as string) ?? "";
  const alt = (widget.content.alt as string) ?? "";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCss(widget.styles, device);
  const { width, height, ...wrapperRest } = css;

  const img = (
    <img
      src={src}
      alt={alt}
      style={{ width, height, maxWidth: "100%", display: "block" }}
      loading="lazy"
    />
  );

  return (
    <div
      style={{
        ...wrapperRest,
        display: "flex",
        justifyContent: alignToFlexJustify(align),
      }}
    >
      {img}
    </div>
  );
}

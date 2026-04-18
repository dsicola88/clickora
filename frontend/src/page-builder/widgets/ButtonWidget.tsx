import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export function ButtonWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const text = (widget.content.text as string) ?? "Botão";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCss(widget.styles, device);
  // We split alignment off the inner button — the wrapper handles it.
  return (
    <div style={{ display: "flex", justifyContent: alignToFlexJustify(align) }}>
      <button
        type="button"
        style={{ ...css, cursor: "pointer", border: css.border ?? "none" }}
        onClick={(e) => e.preventDefault()}
      >
        {text}
      </button>
    </div>
  );
}

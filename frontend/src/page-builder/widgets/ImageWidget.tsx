import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export function ImageWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const src = (widget.content.src as string) ?? "";
  const alt = (widget.content.alt as string) ?? "";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCss(widget.styles, device);
  const { width, height, ...wrapperRest } = css;

  const hasSrc = src.trim().length > 0;

  const inner = hasSrc ? (
    <img
      src={src}
      alt={alt}
      style={{ width, height, maxWidth: "100%", display: "block" }}
      loading="lazy"
    />
  ) : (
    <div
      style={{
        minHeight: 120,
        maxWidth: "100%",
        width: width ?? "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "#f1f5f9",
        color: "#64748b",
        fontSize: 12,
        textAlign: "center",
        lineHeight: 1.45,
        borderRadius: 8,
        border: "1px dashed #cbd5e1",
      }}
    >
      Sem imagem — no painel: URL ou «Carregar do PC»
    </div>
  );

  return (
    <div
      style={{
        ...wrapperRest,
        display: "flex",
        justifyContent: alignToFlexJustify(align),
      }}
    >
      {inner}
    </div>
  );
}

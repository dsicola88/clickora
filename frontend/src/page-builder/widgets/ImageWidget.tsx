import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import { useInlineEdit } from "../inline-edit";
import { useClaimLcpMedia } from "../lcp-media";

export function ImageWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const src = (widget.content.src as string) ?? "";
  const alt = (widget.content.alt as string) ?? "";
  const link = ((widget.content.link as string) ?? "").trim();
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const { width, height, ...wrapperRest } = css;
  const editing = Boolean(useInlineEdit());
  const hasSrc = src.trim().length > 0;
  const priority = useClaimLcpMedia(hasSrc);

  const inner = hasSrc ? (
    <img
      src={src}
      alt={alt}
      style={{ width, height, maxWidth: "100%", display: "block" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
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

  const placeholderHref = !link || link === "#" || link.startsWith("#");
  const media =
    !editing && link ? (
      <a
        href={placeholderHref ? "#" : link}
        data-clickora-offer={placeholderHref ? "1" : undefined}
        style={{ display: "block", maxWidth: "100%" }}
      >
        {inner}
      </a>
    ) : (
      inner
    );

  return (
    <div
      style={{
        ...wrapperRest,
        display: "flex",
        justifyContent: alignToFlexJustify(align),
      }}
    >
      {media}
    </div>
  );
}

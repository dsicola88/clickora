import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import { useInlineEdit } from "../inline-edit";
import { useClaimLcpMedia } from "../lcp-media";

export function ImageWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const src = (widget.content.src as string) ?? "";
  const alt = (widget.content.alt as string) ?? "";
  const link = ((widget.content.link as string) ?? "").trim();
  const isHero = widget.content.hero === true;
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const { width, height, ...wrapperRest } = css;
  const editing = Boolean(useInlineEdit());
  const hasSrc = src.trim().length > 0;
  const priority = useClaimLcpMedia(hasSrc);
  const [failed, setFailed] = useState(false);

  const inner =
    isHero && hasSrc && failed ? (
      <div
        data-presell-hero="unavailable"
        style={{
          minHeight: "52vh",
          width: width ?? "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          color: "#64748b",
          fontSize: 14,
        }}
      >
        Imagem indisponível
      </div>
    ) : hasSrc ? (
    <div
      data-presell-hero={isHero ? "product" : undefined}
      data-presell-hero-emphasis={isHero ? "primary" : undefined}
      style={{
        width: "100%",
        maxWidth: "100%",
        minHeight: isHero ? "min(72vh, 680px)" : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isHero ? "#f8fafc" : undefined,
      }}
    >
    <img
      src={src}
      alt={alt}
      style={{
        width: "100%",
        height: isHero ? "auto" : height,
        minHeight: isHero ? "min(64vh, 620px)" : undefined,
        maxWidth: "100%",
        display: "block",
        objectFit: isHero ? "contain" : undefined,
      }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
    />
    </div>
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

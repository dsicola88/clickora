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
  const caption = ((widget.content.caption as string) ?? "").trim();
  const objectFit =
    ((widget.content.objectFit as string) ??
      (widget.content.hero === true || widget.content.portalProduct === true ? "contain" : "cover")) as
      | "contain"
      | "cover"
      | "fill"
      | "none"
      | "scale-down";
  const isHero = widget.content.hero === true;
  const portalProduct = widget.content.portalProduct === true;
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const { width, height, ...wrapperRest } = css;
  const mediaWidth = width ?? "100%";
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
          width: mediaWidth,
          maxWidth: "100%",
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
      data-presell-portal-photo={portalProduct ? "1" : undefined}
      style={{
        width: mediaWidth,
        maxWidth: portalProduct ? "min(100%, 400px)" : "100%",
        margin: portalProduct ? "0 auto" : undefined,
        minHeight: isHero ? "min(58vh, 560px)" : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: isHero || portalProduct ? "#f8fafc" : undefined,
        padding: portalProduct ? 14 : undefined,
        borderRadius: portalProduct ? 14 : undefined,
        border: portalProduct ? "1px solid #e2e8f0" : undefined,
      }}
    >
    <img
      src={src}
      alt={alt}
      style={{
        width: "100%",
        height: isHero ? "auto" : height,
        minHeight: isHero ? "min(52vh, 520px)" : undefined,
        maxWidth: "100%",
        maxHeight: portalProduct ? "min(46vh, 400px)" : undefined,
        display: "block",
        objectFit: isHero || portalProduct ? "contain" : objectFit,
      }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
    />
    {caption ? (
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 13,
          color: "#64748b",
          textAlign: "center",
          width: "100%",
        }}
      >
        {caption}
      </p>
    ) : null}
    </div>
  ) : (
    <div
      style={{
        minHeight: 120,
        width: mediaWidth,
        maxWidth: "100%",
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

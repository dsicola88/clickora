import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { InlinePlain } from "../inline-edit";

export interface ImageBoxContent {
  src: string;
  alt: string;
  title: string;
  description: string;
  href: string;
  titleColor: string;
  descColor: string;
  imageHeight: number;
  objectFit: "cover" | "contain";
}

export function ImageBoxWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<ImageBoxContent>;
  const href = (c.href ?? "").trim();
  const img = (
    <img
      src={(c.src ?? "").trim() || "https://placehold.co/640x360/e2e8f0/64748b?text=Imagem"}
      alt={c.alt ?? ""}
      style={{
        width: "100%",
        height: c.imageHeight ?? 200,
        objectFit: c.objectFit ?? "cover",
        display: "block",
        borderRadius: widget.styles.border?.radius ?? 8,
      }}
    />
  );

  return (
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
      {href ? (
        <a href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          {img}
        </a>
      ) : (
        img
      )}
      <h3
        style={{
          margin: "12px 0 6px",
          fontSize: 18,
          fontWeight: 700,
          color: c.titleColor ?? "#0f172a",
        }}
      >
        <InlinePlain value={c.title ?? "Título da caixa"} field="title" />
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: c.descColor ?? "#64748b" }}>
        <InlinePlain value={c.description ?? "Descrição curta do bloco."} field="description" />
      </p>
    </div>
  );
}

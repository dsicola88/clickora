import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export interface LogoContent {
  src: string;
  alt: string;
  link: string;
  width: number;
}

export function LogoWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<LogoContent>;
  const src = c.src ?? "";
  const alt = c.alt ?? "Logo";
  const link = c.link ?? "/";
  const width = c.width ?? 140;
  const align = resolveResponsive(widget.styles.align, device);

  const img = src ? (
    <img
      src={src}
      alt={alt}
      style={{ width, height: "auto", display: "block" }}
    />
  ) : (
    <div
      style={{
        width,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
        color: "#6b7280",
        fontSize: 12,
        borderRadius: 4,
      }}
    >
      LOGO
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        ...stylesToCss(widget.styles, device),
      }}
    >
      {link ? (
        <a href={link} aria-label={alt} style={{ display: "inline-block" }}>
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}

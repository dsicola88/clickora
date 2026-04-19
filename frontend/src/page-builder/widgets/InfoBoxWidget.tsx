import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import * as Icons from "lucide-react";
import type { ComponentType } from "react";

export interface InfoBoxContent {
  iconName: string;
  iconColor: string;
  iconBg: string;
  iconShape: "square" | "circle" | "none";
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  layout: "stacked" | "side";
  align: "left" | "center" | "right";
  titleColor: string;
  descColor: string;
  ctaColor: string;
  bg: string;
  borderRadius: number;
}

export function InfoBoxWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<InfoBoxContent>;
  const iconName = (c.iconName ?? "sparkles").trim();
  const compName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  const IconComp =
    ((Icons as unknown as Record<string, ComponentType<{ size?: number; color?: string }>>)[compName] as
      | ComponentType<{ size?: number; color?: string }>
      | undefined) ?? Icons.Sparkles;
  const layout = c.layout ?? "stacked";
  const align = c.align ?? "center";
  const isSide = layout === "side" && device !== "mobile";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isSide ? "row" : "column",
        alignItems: isSide
          ? "flex-start"
          : align === "center"
            ? "center"
            : align === "right"
              ? "flex-end"
              : "flex-start",
        textAlign: isSide ? "left" : align,
        gap: 16,
        background: c.bg ?? "transparent",
        borderRadius: c.borderRadius ?? 0,
        ...stylesToCssWidgetContent(widget.styles, device),
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
          background: c.iconShape === "none" ? "transparent" : c.iconBg ?? "#fef2f2",
          borderRadius: c.iconShape === "circle" ? "50%" : c.iconShape === "none" ? 0 : 12,
          flexShrink: 0,
        }}
      >
        <IconComp size={32} color={c.iconColor ?? "#e63946"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 700,
            color: c.titleColor ?? "#0f172a",
          }}
        >
          {c.title ?? "Título"}
        </h3>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 14,
            lineHeight: 1.6,
            color: c.descColor ?? "#475569",
          }}
        >
          {c.description ?? "Descrição"}
        </p>
        {c.ctaText ? (
          <a
            href={c.ctaHref || "#"}
            style={{
              color: c.ctaColor ?? "#e63946",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {c.ctaText} →
          </a>
        ) : null}
      </div>
    </div>
  );
}

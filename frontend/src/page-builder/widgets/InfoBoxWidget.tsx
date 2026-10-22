import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { InlinePlain } from "../inline-edit";
import { Sparkles } from "lucide-react";
import { resolveLucideIconOr } from "../lucide-icon";

export interface InfoBoxContent {
  iconName: string;
  iconColor: string;
  iconBg: string;
  iconShape: "square" | "circle" | "none";
  iconSize: number;
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
  const IconComp = resolveLucideIconOr(c.iconName ?? "sparkles", Sparkles);
  const layout = c.layout ?? "stacked";
  const align = c.align ?? "center";
  const isSide = layout === "side" && device !== "mobile";
  const iconSize = typeof c.iconSize === "number" ? c.iconSize : 32;
  const visual = stylesToCssWidgetContent(widget.styles, device);

  return (
    <div
      style={{
        ...visual,
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
        // Content bg wins over Style when set (Elementor Content vs Style).
        background: c.bg ?? visual.background ?? "transparent",
        borderRadius: c.borderRadius ?? (visual.borderRadius as number | string | undefined) ?? 0,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: Math.max(48, iconSize + 32),
          height: Math.max(48, iconSize + 32),
          background: c.iconShape === "none" ? "transparent" : c.iconBg ?? "#fef2f2",
          borderRadius: c.iconShape === "circle" ? "50%" : c.iconShape === "none" ? 0 : 12,
          flexShrink: 0,
        }}
      >
        <IconComp size={iconSize} color={c.iconColor ?? "#e63946"} />
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
          <InlinePlain value={c.title ?? "Título"} field="title" />
        </h3>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 14,
            lineHeight: 1.6,
            color: c.descColor ?? "#475569",
          }}
        >
          <InlinePlain value={c.description ?? "Descrição"} field="description" />
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

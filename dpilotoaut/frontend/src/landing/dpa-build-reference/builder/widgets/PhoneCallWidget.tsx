import { Phone } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export interface PhoneCallContent {
  number: string;
  displayText: string;
  variant: "button" | "link" | "floating";
  bg: string;
  color: string;
  borderRadius: number;
  showIcon: boolean;
  fontSize: number;
  position: "right" | "left";
}

export function PhoneCallWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<PhoneCallContent>;
  const number = c.number ?? "+5511999999999";
  const displayText = c.displayText ?? "Ligar agora";
  const variant = c.variant ?? "button";
  const bg = c.bg ?? "#10b981";
  const color = c.color ?? "#ffffff";
  const borderRadius = c.borderRadius ?? 8;
  const showIcon = c.showIcon ?? true;
  const fontSize = c.fontSize ?? 16;
  const position = c.position ?? "right";
  const align = resolveResponsive(widget.styles.align, device);

  if (variant === "floating") {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <a
          href={`tel:${number.replace(/\D/g, "")}`}
          aria-label={displayText}
          style={{
            position: "fixed",
            bottom: 80,
            [position]: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: bg,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 24px rgba(16,185,129,.45)",
            zIndex: 9989,
            textDecoration: "none",
            animation: "lov-pulse 2s ease infinite",
          }}
        >
          <Phone size={24} />
          <style dangerouslySetInnerHTML={{
            __html: "@keyframes lov-pulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}70%{box-shadow:0 0 0 14px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}",
          }} />
        </a>
      </div>
    );
  }

  if (variant === "link") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: alignToFlexJustify(align),
          ...stylesToCss(widget.styles, device),
        }}
      >
        <a
          href={`tel:${number.replace(/\D/g, "")}`}
          style={{
            color,
            fontSize,
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {showIcon && <Phone size={fontSize + 2} />}
          {displayText}
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        ...stylesToCss(widget.styles, device),
      }}
    >
      <a
        href={`tel:${number.replace(/\D/g, "")}`}
        style={{
          background: bg,
          color,
          padding: "12px 20px",
          borderRadius,
          fontSize,
          fontWeight: 600,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {showIcon && <Phone size={fontSize + 2} />}
        {displayText}
      </a>
    </div>
  );
}

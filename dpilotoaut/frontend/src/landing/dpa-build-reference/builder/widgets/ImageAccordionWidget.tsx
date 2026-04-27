import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface ImageAccordionItem {
  id: string;
  src: string;
  title: string;
  subtitle?: string;
  link?: string;
}

export interface ImageAccordionContent {
  items: ImageAccordionItem[];
  height: number;
  borderRadius: number;
  gap: number;
  overlayColor: string;
}

export function ImageAccordionWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<ImageAccordionContent>;
  const items = c.items ?? [];
  const height = c.height ?? 380;
  const borderRadius = c.borderRadius ?? 8;
  const gap = c.gap ?? 8;
  const overlayColor = c.overlayColor ?? "rgba(0,0,0,0.45)";
  const [hovered, setHovered] = useState(0);

  if (items.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione imagens no painel de propriedades.
        </p>
      </div>
    );
  }

  const isMobile = device === "mobile";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap,
        height: isMobile ? "auto" : height,
        ...stylesToCss(widget.styles, device),
      }}
    >
      {items.map((item, i) => {
        const isActive = i === hovered;
        const Wrapper = item.link ? "a" : "div";
        return (
          <Wrapper
            key={item.id}
            href={item.link}
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            style={{
              position: "relative",
              flex: isMobile ? "0 0 auto" : isActive ? 4 : 1,
              height: isMobile ? 200 : "100%",
              borderRadius,
              overflow: "hidden",
              cursor: item.link ? "pointer" : "default",
              transition: "flex 0.45s ease",
              backgroundImage: `url(${item.src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              textDecoration: "none",
              color: "#fff",
              display: "block",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to top, ${overlayColor}, transparent 60%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "auto 0 0 0",
                padding: 20,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{item.title}</div>
              {item.subtitle && isActive && (
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{item.subtitle}</div>
              )}
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

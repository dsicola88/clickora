import { useRef, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface ImageScrollContent {
  src: string;
  alt: string;
  height: number;
  direction: "vertical" | "horizontal";
  borderRadius: number;
  speed: number; // 1 = match cursor, lower = slower scroll
}

export function ImageScrollWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<ImageScrollContent>;
  const src = c.src ?? "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=1200&q=80";
  const alt = c.alt ?? "";
  const height = c.height ?? 360;
  const direction = c.direction ?? "vertical";
  const borderRadius = c.borderRadius ?? 8;
  const speed = c.speed ?? 1;

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    const ratio =
      direction === "vertical"
        ? (point.clientY - rect.top) / rect.height
        : (point.clientX - rect.left) / rect.width;
    setPos(Math.max(0, Math.min(1, ratio)) * speed);
  };

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onTouchMove={onMove}
        style={{
          position: "relative",
          height,
          borderRadius,
          overflow: "hidden",
          cursor: direction === "vertical" ? "ns-resize" : "ew-resize",
          background: "#f3f4f6",
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: direction === "horizontal" ? "auto" : "100%",
            height: direction === "vertical" ? "auto" : "100%",
            position: "absolute",
            top: direction === "vertical" ? `calc(${-pos * 100}% + ${pos * height}px)` : 0,
            left: direction === "horizontal" ? `calc(${-pos * 100}% + ${pos * (ref.current?.offsetWidth ?? 0)}px)` : 0,
            transition: "all 0.05s linear",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 4,
            pointerEvents: "none",
          }}
        >
          {direction === "vertical" ? "↕ Mova o cursor" : "↔ Mova o cursor"}
        </div>
      </div>
    </div>
  );
}

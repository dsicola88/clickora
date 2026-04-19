import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface ReadingProgressContent {
  height: number;
  bg: string;
  fillColor: string;
  position: "top" | "bottom";
}

export function ReadingProgressWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<ReadingProgressContent>;
  const height = c.height ?? 4;
  const bg = c.bg ?? "transparent";
  const fillColor = c.fillColor ?? "#e63946";
  const position = c.position ?? "top";
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const p = total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0;
      setPct(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          [position]: 0,
          height,
          background: bg,
          zIndex: 9991,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: fillColor,
            transition: "width 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}

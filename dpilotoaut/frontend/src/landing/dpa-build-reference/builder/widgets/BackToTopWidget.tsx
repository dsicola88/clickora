import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface BackToTopContent {
  threshold: number;
  position: "right" | "left";
  bg: string;
  color: string;
  size: number;
  shape: "circle" | "square";
}

export function BackToTopWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<BackToTopContent>;
  const threshold = c.threshold ?? 300;
  const position = c.position ?? "right";
  const bg = c.bg ?? "#0f172a";
  const color = c.color ?? "#ffffff";
  const size = c.size ?? 48;
  const shape = c.shape ?? "circle";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <button
        type="button"
        aria-label="Voltar ao topo"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          bottom: 24,
          [position]: 24,
          width: size,
          height: size,
          borderRadius: shape === "circle" ? "50%" : 8,
          background: bg,
          color,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.25s ease",
          zIndex: 9990,
        }}
      >
        <ArrowUp size={size * 0.5} />
      </button>
    </div>
  );
}

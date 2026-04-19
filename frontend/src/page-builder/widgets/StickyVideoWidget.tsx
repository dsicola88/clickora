import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";
import { resolvePageBuilderVideoUrl } from "../videoEmbed";

export interface StickyVideoContent {
  url: string;
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  width: number;
  aspectRatio: "16/9" | "4/3" | "1/1";
  borderRadius: number;
  showCloseButton: boolean;
  inlineHeight: number;
}

export function StickyVideoWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<StickyVideoContent>;
  const url = (c.url ?? "").trim();
  const position = c.position ?? "bottom-right";
  const width = c.width ?? 320;
  const aspect = c.aspectRatio ?? "16/9";
  const borderRadius = c.borderRadius ?? 8;
  const showCloseButton = c.showCloseButton ?? true;
  const inlineHeight = c.inlineHeight ?? 360;

  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [closed, setClosed] = useState(false);
  const resolved = url ? resolvePageBuilderVideoUrl(url) : null;
  const embedSrc = resolved?.embedUrl ?? null;

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [vSide, hSide] = position.split("-") as ["top" | "bottom", "left" | "right"];

  const iframe = (src: string, title: string) => (
    <iframe
      src={src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      style={{ width: "100%", height: "100%", border: 0 }}
    />
  );

  const placeholder = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        fontSize: 12,
        color: "#94a3b8",
        textAlign: "center",
        lineHeight: 1.45,
      }}
    >
      Cola um URL do YouTube ou Bunny (Conteúdo do widget).
    </div>
  );

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <div
        ref={ref}
        style={{
          width: "100%",
          height: inlineHeight,
          borderRadius,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {embedSrc ? iframe(embedSrc, "Vídeo") : placeholder}
      </div>
      {stuck && !closed && embedSrc ? (
        <div
          style={{
            position: "fixed",
            [vSide]: 20,
            [hSide]: 20,
            width,
            aspectRatio: aspect.replace("/", " / "),
            borderRadius,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            zIndex: 9998,
            background: "#000",
          }}
        >
          {iframe(embedSrc, "Vídeo fixo")}
          {showCloseButton ? (
            <button
              type="button"
              aria-label="Fechar vídeo"
              onClick={(e) => {
                e.stopPropagation();
                setClosed(true);
              }}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

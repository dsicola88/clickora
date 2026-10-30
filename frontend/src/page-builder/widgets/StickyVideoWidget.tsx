import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { embedUrlWithPlayback, resolvePageBuilderVideoUrl } from "../videoEmbed";

export interface StickyVideoContent {
  url: string;
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  width: number;
  aspectRatio: "16/9" | "4/3" | "1/1";
  borderRadius: number;
  showCloseButton: boolean;
  inlineHeight: number;
  autoplay: boolean;
  controls: boolean;
}

export function StickyVideoWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<StickyVideoContent>;
  const url = (c.url ?? "").trim();
  const position = c.position ?? "bottom-right";
  const widthPx = c.width ?? 320;
  const width =
    device === "mobile" ? `min(92vw, ${Math.min(widthPx, 280)}px)` : `min(92vw, ${widthPx}px)`;
  const aspect = c.aspectRatio ?? "16/9";
  const borderRadius = c.borderRadius ?? 8;
  const showCloseButton = c.showCloseButton ?? true;
  const inlineHeight = c.inlineHeight ?? 360;
  const autoplay = c.autoplay === true;
  const controls = c.controls !== false;

  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [closed, setClosed] = useState(false);
  const resolved = url ? resolvePageBuilderVideoUrl(url) : null;
  const embedSrc = resolved
    ? embedUrlWithPlayback(resolved, { autoplay, controls })
    : null;
  const pipSrc = resolved
    ? embedUrlWithPlayback(resolved, { autoplay: true, controls })
    : null;

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [vSide, hSide] = position.split("-") as ["top" | "bottom", "left" | "right"];
  const showPip = stuck && !closed && Boolean(pipSrc);

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
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
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
        {/* Um único leitor: esconde o inline enquanto o PiP está ativo (evita áudio duplo). */}
        {showPip ? (
          <div style={{ width: "100%", height: "100%", background: "#0f172a" }} aria-hidden />
        ) : embedSrc ? (
          iframe(embedSrc, "Vídeo")
        ) : (
          placeholder
        )}
      </div>
      {showPip && pipSrc ? (
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
          {iframe(pipSrc, "Vídeo fixo")}
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

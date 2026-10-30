import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

type LottieComp = ComponentType<{
  src: string | object;
  loop?: boolean | number;
  autoplay?: boolean;
  speed?: number;
  style?: CSSProperties;
}>;

/**
 * Lottie — URL para JSON Lottie.
 * Import dinâmico de `lottie-react` para não puxar lottie-web no bundle do editor/testes.
 */
export function LottieWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content;
  const src = ((c.src as string) ?? "").trim();
  const loop = c.loop !== false;
  const autoplay = c.autoplay !== false;
  const speed = typeof c.speed === "number" && c.speed > 0 ? c.speed : 1;
  const width = typeof c.width === "number" && c.width > 0 ? c.width : 280;
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);

  const [LottieComp, setLottieComp] = useState<LottieComp | null>(null);

  useEffect(() => {
    if (!src) {
      setLottieComp(null);
      return;
    }
    let cancelled = false;
    void import("lottie-react").then((mod) => {
      if (!cancelled) setLottieComp(() => mod.Lottie as LottieComp);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        width: "100%",
        ...css,
      }}
    >
      {!src ? (
        <div
          style={{
            width,
            maxWidth: "100%",
            aspectRatio: "1",
            display: "grid",
            placeItems: "center",
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
            color: "#64748b",
            fontSize: 13,
            padding: 16,
            textAlign: "center",
          }}
        >
          Cole o URL do JSON Lottie na aba Conteúdo
        </div>
      ) : LottieComp ? (
        <LottieComp
          src={src}
          loop={loop}
          autoplay={autoplay}
          speed={speed}
          style={{ width, maxWidth: "100%", height: "auto" }}
        />
      ) : (
        <div
          style={{
            width,
            maxWidth: "100%",
            aspectRatio: "1",
            display: "grid",
            placeItems: "center",
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          A carregar…
        </div>
      )}
    </div>
  );
}

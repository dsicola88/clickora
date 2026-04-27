import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export interface LottieWidgetContent {
  url: string;
  loop: boolean;
  autoplay: boolean;
  speed: number;
  width: number;
}

export function LottieWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<LottieWidgetContent>;
  const url = c.url ?? "";
  const loop = c.loop ?? true;
  const autoplay = c.autoplay ?? true;
  const speed = c.speed ?? 1;
  const width = c.width ?? 280;
  const align = resolveResponsive(widget.styles.align, device);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState(false);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (lottieRef.current) lottieRef.current.setSpeed(speed);
  }, [speed, data]);

  useEffect(() => {
    if (!url) return;
    let active = true;
    setError(false);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("network");
        return r.json();
      })
      .then((j) => {
        if (active) setData(j);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        ...stylesToCss(widget.styles, device),
      }}
    >
      <div style={{ width, maxWidth: "100%" }}>
        {data ? (
          <Lottie
            animationData={data}
            loop={loop}
            autoplay={autoplay}
            lottieRef={lottieRef}
          />
        ) : error ? (
          <div
            style={{
              padding: 20,
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 6,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Não foi possível carregar a animação. Verifique a URL.
          </div>
        ) : url ? (
          <div
            style={{
              width: "100%",
              aspectRatio: "1/1",
              background: "#f3f4f6",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: 12,
            }}
          >
            Carregando…
          </div>
        ) : (
          <div
            style={{
              padding: 20,
              background: "#f3f4f6",
              borderRadius: 6,
              fontSize: 12,
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Cole uma URL de arquivo .json (Lottie) no painel de propriedades.
          </div>
        )}
      </div>
    </div>
  );
}
